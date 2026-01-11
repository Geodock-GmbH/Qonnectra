"""
Migration to remove the WFS error logging triggers and functions.

This migration removes the dblink-based trigger system that was used to send NOTIFY
messages when WFS operations failed validation. The system is being replaced with
a simpler approach that parses PostgreSQL errors directly from Docker container logs.

What is being removed:
- tg_00_log_wfs_error trigger on node table
- tg_00_log_wfs_error trigger on address table
- tg_00_log_wfs_error trigger on trench table
- fn_log_wfs_operation_error() function
- autonomous_pg_notify() function

The reverse SQL recreates these objects if a rollback is needed.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0011_area_ddl"),
    ]

    operations = [
        # Drop triggers first (they depend on the function)
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS tg_00_log_wfs_error ON node;",
            reverse_sql="""
                CREATE TRIGGER tg_00_log_wfs_error
                    BEFORE INSERT OR UPDATE
                    ON node
                    FOR EACH ROW
                EXECUTE PROCEDURE fn_log_wfs_operation_error();
            """,
        ),
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS tg_00_log_wfs_error ON address;",
            reverse_sql="""
                CREATE TRIGGER tg_00_log_wfs_error
                    BEFORE INSERT OR UPDATE
                    ON address
                    FOR EACH ROW
                EXECUTE PROCEDURE fn_log_wfs_operation_error();
            """,
        ),
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS tg_00_log_wfs_error ON trench;",
            reverse_sql="""
                CREATE TRIGGER tg_00_log_wfs_error
                    BEFORE INSERT OR UPDATE
                    ON trench
                    FOR EACH ROW
                EXECUTE PROCEDURE fn_log_wfs_operation_error();
            """,
        ),
        # Drop the trigger function
        migrations.RunSQL(
            sql="DROP FUNCTION IF EXISTS fn_log_wfs_operation_error();",
            reverse_sql="""
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
                    v_flag_ids           integer[] := (select array_agg(id) from flags);
                    v_project_ids        integer[] := (select array_agg(id) from projects);
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

                            if new.flag <> all (v_flag_ids) then
                                v_error_message := 'Flag must be a valid flag.' || ' ' ||
                                                '(' || new.name || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'flag', 'uuid',
                                                        new.uuid, 'attempted_value', new.flag, 'valid_values',
                                                        v_flag_ids);
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

                            if new.project <> all (v_project_ids) then
                                v_error_message := 'Project must be a valid project.' || ' ' ||
                                                '(' || new.name || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'project', 'uuid',
                                                        new.uuid, 'attempted_value', new.project, 'valid_values',
                                                        v_project_ids);
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
                                                coalesce(new.housenumber::text, ''),
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

                            if new.flag <> all (v_flag_ids) then
                                v_error_message := 'Flag must be a valid flag.' || ' ' ||
                                                format('(%s %s%s, %s %s)',
                                                        coalesce(new.street, ''),
                                                        coalesce(new.housenumber::text, ''),
                                                        coalesce(new.house_number_suffix, ''),
                                                        coalesce(new.zip_code, ''),
                                                        coalesce(new.city, ''));
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'flag', 'uuid',
                                                        new.uuid, 'attempted_value', new.flag, 'valid_values',
                                                        v_flag_ids);
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.address',
                                        'message', v_error_message,
                                        'extra_data', v_error_detail,
                                        'project_id', v_project_id
                                                );
                                perform autonomous_pg_notify('wfs_error_channel', v_notification::text);
                                raise exception using message = v_error_message, errcode = '23503';
                            end if;

                            if new.project <> all (v_project_ids) then
                                v_error_message := 'Project must be a valid project.' || ' ' ||
                                                format('(%s %s%s, %s %s)',
                                                        coalesce(new.street, ''),
                                                        coalesce(new.housenumber::text, ''),
                                                        coalesce(new.house_number_suffix, ''),
                                                        coalesce(new.zip_code, ''),
                                                        coalesce(new.city, ''));
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'project', 'uuid',
                                                        new.uuid, 'attempted_value', new.project, 'valid_values',
                                                        v_project_ids);
                                v_notification := jsonb_build_object(
                                        'level', 'ERROR',
                                        'logger_name', 'trigger.address',
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

                            if new.flag <> all (v_flag_ids) then
                                v_error_message := 'Flag must be a valid flag.' || ' ' ||
                                                '(' || new.id_trench || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'flag', 'id_trench',
                                                        new.id_trench, 'attempted_value', new.flag, 'valid_values',
                                                        v_flag_ids);
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

                            if new.project <> all (v_project_ids) then
                                v_error_message := 'Project must be a valid project.' || ' ' ||
                                                '(' || new.id_trench || ')';
                                v_error_detail :=
                                        v_error_detail ||
                                        jsonb_build_object('error_type', 'foreign_key_violation', 'field', 'project', 'id_trench',
                                                        new.id_trench, 'attempted_value', new.project, 'valid_values',
                                                        v_project_ids);
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
        ),
        # Drop the autonomous notify function
        migrations.RunSQL(
            sql="DROP FUNCTION IF EXISTS autonomous_pg_notify(text, text);",
            reverse_sql="""
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
                    v_conn_name := 'wfs_notify_' || pg_backend_pid()::text || '_' || extract(epoch from clock_timestamp())::bigint::text;
                    v_conn_string := format(
                        'host=127.0.0.1 port=5432 dbname=%s user=%s',
                        current_database(),
                        current_user
                    );
                    PERFORM dblink_connect(v_conn_name, v_conn_string);
                    v_query := format('SELECT pg_notify(%L, %L)', p_channel, p_payload);
                    PERFORM dblink_exec(v_conn_name, v_query, false);
                    PERFORM dblink_disconnect(v_conn_name);
                EXCEPTION WHEN OTHERS THEN
                    BEGIN
                        PERFORM dblink_disconnect(v_conn_name);
                    EXCEPTION WHEN OTHERS THEN
                    END;
                    RAISE NOTICE 'Failed to send WFS error notification: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
                END;
                $func$
                LANGUAGE plpgsql
                SECURITY DEFINER;
            """,
        ),
    ]
