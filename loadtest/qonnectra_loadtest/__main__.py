"""Command line for the database jobs: seed data, load-test users, statistics.

The web UI runs these as subprocesses, so the database work never blocks the
load generator. They also work by hand inside the container::

    python -m qonnectra_loadtest seed --preset medium
    python -m qonnectra_loadtest purge
    python -m qonnectra_loadtest users --count 60
    python -m qonnectra_loadtest status
    python -m qonnectra_loadtest postgres-statistics on
"""

import argparse
import json
import os
import sys


def setup_django():
    """Configure Django with the backend settings the image ships."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    import django

    django.setup()


def main(argv: list[str] | None = None) -> int:
    """Parse the command line and run one job.

    Args:
        argv: Arguments without the program name, ``sys.argv[1:]`` by default.

    Returns:
        int: Process exit code.
    """
    parser = argparse.ArgumentParser(prog="python -m qonnectra_loadtest")
    commands = parser.add_subparsers(dest="command", required=True)

    seed = commands.add_parser("seed", help="Create loadtest-NN projects")
    seed.add_argument("--preset", default="small")
    seed.add_argument("--km", type=float)
    seed.add_argument("--projects", type=int, default=3)
    seed.add_argument("--houses-per-street", type=int, default=6)
    seed.add_argument("--seed", type=int, default=1)

    commands.add_parser("purge", help="Delete loadtest-NN projects and users")

    users = commands.add_parser("users", help="Print tokens of load-test users")
    users.add_argument("--count", type=int, default=20)

    commands.add_parser("status", help="Print seeded projects and user count")

    statistics = commands.add_parser(
        "postgres-statistics",
        help="Switch pg_stat_statements and the slow-query log on or off "
        "(restarts the db container)",
    )
    statistics.add_argument("state", choices=["on", "off"])

    args = parser.parse_args(argv)

    def log(line: str):
        """Print a progress line right away, so the dashboard log streams."""
        print(line, flush=True)

    if args.command == "postgres-statistics":
        from qonnectra_loadtest import docker
        from qonnectra_loadtest.postgres import Postgres, switch_statistics

        switched = switch_statistics(
            args.state == "on",
            Postgres(),
            restart=lambda: docker.restart_service("db"),
            log=log,
        )
        return 0 if switched else 1

    setup_django()
    from qonnectra_loadtest import accounts, seeding

    if args.command == "seed":
        if args.preset not in seeding.PRESET_KM:
            parser.error(f"--preset must be one of {', '.join(seeding.PRESET_KM)}")
        try:
            seeding.seed(
                preset=args.preset,
                km=args.km,
                projects=args.projects,
                houses_per_street=args.houses_per_street,
                random_seed=args.seed,
                log=log,
            )
        except seeding.SeedError as error:
            print(error, file=sys.stderr)
            return 1
    elif args.command == "purge":
        seeding.purge(log=log)
        log(f"Deleted {accounts.purge_users()} load-test users")
    elif args.command == "users":
        print(json.dumps(accounts.create_users(args.count)))
    elif args.command == "status":
        print(
            json.dumps(
                {
                    "projects": seeding.seeded_projects(),
                    "users": accounts.count_users(),
                    "presets": seeding.PRESET_KM,
                }
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
