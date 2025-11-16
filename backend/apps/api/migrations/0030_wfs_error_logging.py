from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0029_logentry_project_logentry_idx_log_entry_project"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                -- Create function to send notifications via autonomous transaction
                -- This allows notifications to be delivered even when the main transaction rolls back
                CREATE OR REPLACE FUNCTION autonomous_pg_notify(
                    p_channel text,
                    p_payload text
                ) RETURNS void AS
                $func$
                DECLARE
                    v_conn_name text;
                    v_conn_string text;
                    v_query text;
                BEGIN
                    -- Generate unique connection name using backend PID
                    v_conn_name := 'wfs_notify_' || pg_backend_pid()::text || '_' || extract(epoch from clock_timestamp())::bigint::text;

                    -- Build connection string using localhost loopback
                    -- Uses 127.0.0.1 for self-connection inside the database container
                    -- Works with existing pg_hba.conf trust rule: "host all all 127.0.0.1/32 trust"
                    v_conn_string := format(
                        'host=127.0.0.1 port=5432 dbname=%s user=%s',
                        current_database(),
                        current_user
                    );

                    -- Connect via dblink (creates new independent connection)
                    PERFORM dblink_connect(v_conn_name, v_conn_string);

                    -- Execute NOTIFY in the separate connection
                    -- This commits independently when we disconnect
                    v_query := format('SELECT pg_notify(%L, %L)', p_channel, p_payload);
                    PERFORM dblink_exec(v_conn_name, v_query, false);

                    -- Disconnect (this commits the NOTIFY)
                    PERFORM dblink_disconnect(v_conn_name);

                EXCEPTION WHEN OTHERS THEN
                    -- Ensure connection cleanup on error
                    BEGIN
                        PERFORM dblink_disconnect(v_conn_name);
                    EXCEPTION WHEN OTHERS THEN
                        -- Ignore errors during cleanup (connection may not exist)
                    END;

                    -- Log failure but don't break the trigger
                    -- The validation error will still be raised to the client
                    RAISE NOTICE 'Failed to send WFS error notification: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
                END;
                $func$
                LANGUAGE plpgsql
                SECURITY DEFINER;  -- Run with definer privileges to access dblink

                -- Add comment explaining the function
                COMMENT ON FUNCTION autonomous_pg_notify(text, text) IS
                'Sends PostgreSQL NOTIFY in an autonomous transaction via dblink. '
                'This allows notifications to be delivered even when the calling transaction rolls back. '
                'Used by WFS error logging triggers to ensure error notifications survive validation failures.'
                'https://stackoverflow.com/questions/1113277/how-do-i-do-large-non-blocking-updates-in-postgresql/22163648#22163648';
            """,
            reverse_sql="""
                DROP FUNCTION IF EXISTS autonomous_pg_notify(text, text);
            """,
        ),
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE FUNCTION fn_log_wfs_operation_error() RETURNS trigger
                    LANGUAGE plpgsql
                AS
                $$
                DECLARE
                    v_error_message      text;
                    v_error_detail       jsonb;
                    v_project_id         integer;
                    v_operation          text;
                    v_timestamp          timestamptz := now();
                    v_construction_types integer[] := (select array_agg(id) from attributes_construction_type);
                    v_surface_types      integer[] := (select array_agg(id) from attributes_surface);
                    v_node_types         integer[] := (select array_agg(id) from attributes_node_type);
                    v_notification       jsonb;
                BEGIN
                    if tg_op = 'INSERT' then
                        v_operation := 'INSERT';
                    elsif tg_op = 'UPDATE' then
                        v_operation := 'UPDATE';
                    elsif tg_op = 'DELETE' then
                        v_operation := 'DELETE';
                    end if;
                    v_error_detail :=
                            jsonb_build_object('table', tg_table_name, 'operation', v_operation, 'timestamp', v_timestamp);

                    -- NODE TABLE VALIDATIONS
                    if tg_table_name = 'node' then

                        if tg_op in ('INSERT', 'UPDATE') then
                            v_project_id := new.project;
                        elsif tg_op = 'DELETE' then
                            v_project_id := old.project;
                        end if;

                        if tg_op in ('INSERT', 'UPDATE') then
                            if exists (select 1
                                    from node
                                    where project = new.project
                                        and name = new.name
                                        and uuid != new.uuid) then
                                v_error_message := format(
                                        'Node name "%s" already exists in this project.',
                                        new.name
                                                );
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'unique_constraint_violation', 'constraint',
                                                        'unique_node_name_per_project', 'field', 'name', 'attempted_value',
                                                        new.name, 'project_id', new.project);
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.node',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using
                                    message = v_error_message,
                                    errcode = '23505',
                                    hint = 'Choose a different name for this node.';
                            end if;

                            if (new.geom is null or new.node_type is null or new.name is null or
                                new.flag is null or new.project is null) then
                                v_error_message :=
                                        'Node geometry, type, name, flag and project are required. NULL values are not allowed.';
                                v_error_detail :=
                                        v_error_detail || jsonb_build_object('error_type', 'not_null_violation', 'fields',
                                                                            jsonb_build_array('geom', 'node_type', 'name', 'flag',
                                                                                            'project'));
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.node',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23502';
                            end if;

                            if new.node_type <> all (v_node_types) then
                                v_error_message := 'Node type must be a valid node type.' || ' ' ||
                                                '(' || new.name || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'node_type', 'uuid',
                                                        new.uuid, 'attempted_value', new.node_type, 'valid_values',
                                                        v_node_types);
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.node',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23503';
                            end if;

                        end if;

                        if tg_op = 'DELETE' then
                            return old;
                        else
                            return new;
                        end if;

                    end if;

                    -- ADDRESS TABLE VALIDATIONS
                    if tg_table_name = 'address' then

                        if tg_op in ('INSERT', 'UPDATE') then
                            v_project_id := new.project;
                        elsif tg_op = 'DELETE' then
                            v_project_id := old.project;
                        end if;

                        if tg_op in ('INSERT', 'UPDATE') then

                            if (new.geom is null or new.city is null or new.zip_code is null or new.street is null or
                                new.housenumber is null) then
                                v_error_message :=
                                        format(
                                                'Address geometry, city, zip code, street and housenumber are required. NULL values are not allowed. (%s %s%s, %s %s)',
                                                coalesce(new.street, ''),
                                                coalesce(new.housenumber::text, ''), -- Cast to text
                                                coalesce(new.house_number_suffix, ''),
                                                coalesce(new.zip_code, ''),
                                                coalesce(new.city, '')
                                        );

                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'not_null_violation', 'fields',
                                                        jsonb_build_array('geom', 'city', 'zip_code', 'street', 'housenumber'));
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.address',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23502';
                            end if;
                        end if;

                        if tg_op = 'DELETE' then
                            return old;
                        else
                            return new;
                        end if;

                    end if;

                    -- TRENCH TABLE VALIDATIONS
                    if tg_table_name = 'trench' then

                        if tg_op in ('INSERT', 'UPDATE') then
                            v_project_id := new.project;
                        elsif tg_op = 'DELETE' then
                            v_project_id := old.project;
                        end if;

                        if tg_op in ('INSERT', 'UPDATE') then
                            if (new.geom is null or new.construction_type is null or new.surface is null or new.flag is null or
                                new.project is null) then
                                v_error_message :=
                                        'Trench geometry, construction_type, surface, flag and project are required. NULL values are not allowed.' ||
                                        ' ' ||
                                        '(' || new.id_trench || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'not_null_violation', 'fields',
                                                        jsonb_build_array('geom', 'construction_type',
                                                                            'surface', 'flag',
                                                                            'project'));
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.trench',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23502';
                            end if;


                            if new.construction_type <> all (v_construction_types) then
                                v_error_message := 'Construction type must be a valid construction type.' || ' ' ||
                                                '(' || new.id_trench || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'construction_type',
                                                        'id_trench',
                                                        new.id_trench, 'attempted_value', new.construction_type, 'valid_values',
                                                        v_construction_types);
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.trench',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );

                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23503';
                            end if;

                            if new.surface <> all (v_surface_types) then
                                v_error_message := 'Surface must be a valid surface type.' || ' ' ||
                                                '(' || new.id_trench || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'surface', 'id_trench',
                                                        new.id_trench, 'attempted_value', new.surface, 'valid_values',
                                                        v_surface_types);
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.trench',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23503';
                            end if;

                        end if;

                        if tg_op = 'DELETE' then
                            return old;
                        else
                            return new;
                        end if;
                    end if;
                END;
                $$;
            """,
            reverse_sql="""
                drop function if exists fn_log_wfs_operation_error();
            """,
        ),
        migrations.RunSQL(
            sql="""
                create trigger tg_00_log_wfs_error
                    before insert or update
                    on node
                    for each row
                execute procedure fn_log_wfs_operation_error();
            """,
            reverse_sql="drop trigger if exists tg_00_log_wfs_error on node;",
        ),
        migrations.RunSQL(
            sql="""
                create trigger tg_00_log_wfs_error
                    before insert or update
                    on address
                    for each row
                execute procedure fn_log_wfs_operation_error();
            """,
            reverse_sql="drop trigger if exists tg_00_log_wfs_error on address;",
        ),
        migrations.RunSQL(
            sql="""
                create trigger tg_00_log_wfs_error
                    before insert or update
                    on trench
                    for each row
                execute procedure fn_log_wfs_operation_error();
            """,
            reverse_sql="drop trigger if exists tg_00_log_wfs_error on trench;",
        ),
    ]
