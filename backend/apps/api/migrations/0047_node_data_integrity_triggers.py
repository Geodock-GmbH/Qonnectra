from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0046_networkschemasettings_child_view_enabled_node_types"),
    ]

    operations = [
        # Trigger 1: Prevent node type change when node has children AND cables
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE FUNCTION fn_prevent_node_type_change_with_dependencies()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF OLD.node_type IS DISTINCT FROM NEW.node_type THEN
                        IF EXISTS (SELECT 1 FROM node WHERE parent_node = OLD.uuid) THEN
                            IF EXISTS (SELECT 1 FROM cable WHERE uuid_node_start = OLD.uuid OR uuid_node_end = OLD.uuid) THEN
                                RAISE EXCEPTION 'Cannot change node type: node has both child nodes and connected cables.';
                            END IF;
                        END IF;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_prevent_node_type_change_with_dependencies();",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER tg_prevent_node_type_change_with_dependencies
                    BEFORE UPDATE OF node_type ON node
                    FOR EACH ROW
                EXECUTE FUNCTION fn_prevent_node_type_change_with_dependencies();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_prevent_node_type_change_with_dependencies ON node;",
        ),
        # Trigger 2: Prevent parent_node change when child has cables
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE FUNCTION fn_prevent_parent_change_with_cables()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF OLD.parent_node IS DISTINCT FROM NEW.parent_node THEN
                        IF EXISTS (SELECT 1 FROM cable WHERE uuid_node_start = OLD.uuid OR uuid_node_end = OLD.uuid) THEN
                            RAISE EXCEPTION 'Cannot change parent node: this node has connected cables.';
                        END IF;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_prevent_parent_change_with_cables();",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER tg_prevent_parent_change_with_cables
                    BEFORE UPDATE OF parent_node ON node
                    FOR EACH ROW
                EXECUTE FUNCTION fn_prevent_parent_change_with_cables();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_prevent_parent_change_with_cables ON node;",
        ),
        # Trigger 3: Prevent node deletion when children have cables
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE FUNCTION fn_prevent_node_delete_with_cabled_children()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM node WHERE parent_node = OLD.uuid) THEN
                        IF EXISTS (
                            SELECT 1 FROM cable c
                            JOIN node n ON (c.uuid_node_start = n.uuid OR c.uuid_node_end = n.uuid)
                            WHERE n.parent_node = OLD.uuid
                        ) THEN
                            RAISE EXCEPTION 'Cannot delete node: child nodes have connected cables.';
                        END IF;
                    END IF;
                    RETURN OLD;
                END;
                $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_prevent_node_delete_with_cabled_children();",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER tg_prevent_node_delete_with_cabled_children
                    BEFORE DELETE ON node
                    FOR EACH ROW
                EXECUTE FUNCTION fn_prevent_node_delete_with_cabled_children();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_prevent_node_delete_with_cabled_children ON node;",
        ),
        # Trigger 4: Prevent node deletion when node has direct cables
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE FUNCTION fn_prevent_node_delete_with_cables()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM cable WHERE uuid_node_start = OLD.uuid OR uuid_node_end = OLD.uuid) THEN
                        RAISE EXCEPTION 'Cannot delete node: node has connected cables.';
                    END IF;
                    RETURN OLD;
                END;
                $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_prevent_node_delete_with_cables();",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER tg_prevent_node_delete_with_cables
                    BEFORE DELETE ON node
                    FOR EACH ROW
                EXECUTE FUNCTION fn_prevent_node_delete_with_cables();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_prevent_node_delete_with_cables ON node;",
        ),
    ]
