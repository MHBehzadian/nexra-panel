import psutil

# Sampling CPU with an interval blocks for that long, and the dashboard polls
# this every few seconds. Priming it once here lets later calls measure against
# the previous reading instead, so the endpoint returns immediately.
psutil.cpu_percent(interval=None)


def get_system_info() -> dict:
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=None)
    disk_usage = psutil.disk_usage("/")
    swap = psutil.swap_memory()
    return {
        "total_memory": memory.total,
        "used_memory": memory.used,
        "cpu_percent": cpu_percent,
        "cpu_cores": psutil.cpu_count() or 0,
        "disk_total": disk_usage.total,
        "disk_used": disk_usage.used,
        "swap_total": swap.total,
        "swap_used": swap.used,
    }
