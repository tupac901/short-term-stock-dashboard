from operator import ge, gt, le, lt


OPS = {
    ">=": ge,
    ">": gt,
    "<=": le,
    "<": lt,
}


def is_triggered(value: float, operator: str, threshold: float) -> bool:
    fn = OPS.get(operator)
    if fn is None:
        return False
    return bool(fn(value, threshold))
