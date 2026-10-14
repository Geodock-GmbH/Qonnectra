"""Load profiles to pick in the runner's start form.

``users``, ``spawn rate`` and ``run time`` of the form feed every profile
except Check. Locust's own "Default" stays available for a manual run that
goes until Stop.
"""

from locust import LoadTestShape

RAMP_STEP_USERS = 5
RAMP_STEP_SECONDS = 120
CHECK_TIMEOUT_SECONDS = 600


def _form(shape: LoadTestShape) -> tuple[int, float, float | None]:
    """Return users, spawn rate and run time (seconds or None) from the start form."""
    options = shape.runner.environment.parsed_options
    users = max(1, int(getattr(options, "num_users", None) or 1))
    rate = float(getattr(options, "spawn_rate", None) or 1)
    run_time = getattr(options, "run_time", None) or None
    return users, rate, run_time


class Check(LoadTestShape):
    """One user per selected persona, each running one session, then stop.

    Answers "does every endpoint work" before a real run.
    """

    use_common_options = False
    once = True

    def __init__(self):
        """Prepare a check that has not spawned anyone yet."""
        super().__init__()
        self.spawned = False
        self.saved_counts: dict[type, int] = {}

    def reset_time(self):
        """Restart the check, called by Locust when the test starts."""
        super().reset_time()
        self.spawned = False

    def personas(self) -> list[type]:
        """Return the user classes selected for this run."""
        return list(self.runner.environment.user_classes)

    def peak(self) -> int:
        """Return the number of users the check needs."""
        return len(self.personas())

    def tick(self):
        """Spawn one user per persona, then stop when all have finished.

        Locust spawns synchronously after the first tick, so from the second
        tick on every user has started, and fast sessions may already be over.

        Returns:
            tuple[int, int] | None: Users and spawn rate, None to stop.
        """
        classes = self.personas()
        if not self.spawned:
            for user_class in classes:
                self.saved_counts.setdefault(user_class, user_class.fixed_count)
                user_class.fixed_count = 1
            self.spawned = True
        elif self.get_current_user_count() == 0:
            return None
        if self.get_run_time() > CHECK_TIMEOUT_SECONDS:
            return None
        return len(classes), len(classes)

    def restore(self):
        """Give the persona classes their own ``fixed_count`` back."""
        for user_class, count in self.saved_counts.items():
            user_class.fixed_count = count
        self.saved_counts.clear()


class Steady(LoadTestShape):
    """Ramp up to ``users`` at the spawn rate and hold for the run time (10 min)."""

    use_common_options = True

    def peak(self) -> int:
        """Return the number of users at the top."""
        return _form(self)[0]

    def tick(self):
        """Hold the user count until the run time has passed.

        Returns:
            tuple[int, float] | None: Users and spawn rate, None to stop.
        """
        users, rate, run_time = _form(self)
        if self.get_run_time() > (run_time or 600):
            return None
        return users, rate


class Ramp(LoadTestShape):
    """Add 5 users every 2 minutes up to ``users``: finds the knee."""

    use_common_options = True

    def peak(self) -> int:
        """Return the number of users at the top."""
        return _form(self)[0]

    def tick(self):
        """Climb one step per interval, then stop after the top step.

        Returns:
            tuple[int, int] | None: Users and spawn rate, None to stop.
        """
        users = _form(self)[0]
        step = int(self.get_run_time() // RAMP_STEP_SECONDS)
        target = (step + 1) * RAMP_STEP_USERS
        if target > users + RAMP_STEP_USERS - 1:
            return None
        return min(target, users), 1


class Spike(LoadTestShape):
    """Rise to ``users`` within 2 minutes, hold 5 minutes, stop."""

    use_common_options = True

    def peak(self) -> int:
        """Return the number of users at the top."""
        return _form(self)[0]

    def tick(self):
        """Rise, hold, then stop.

        Returns:
            tuple[int, float] | None: Users and spawn rate, None to stop.
        """
        users = _form(self)[0]
        elapsed = self.get_run_time()
        if elapsed > 7 * 60:
            return None
        return users, max(1.0, users / 120)
