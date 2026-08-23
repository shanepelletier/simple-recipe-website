from decimal import Decimal


def trim(value: Decimal) -> str:
    """5.000 -> "5", 0.500 -> "0.5". Never scientific notation."""
    return f"{value.normalize():f}"


def format_ingredient(quantity: Decimal, unit, ingredient) -> str:
    """Render one line: "2 pounds of beef", "3 whole oranges"."""
    singular = quantity == 1
    unit_word = unit.name if singular else unit.plural

    if unit.takes_of:
        # Mass/volume: the food stays singular after "of".
        return f"{trim(quantity)} {unit_word} of {ingredient.name}"

    food = ingredient.name if singular else ingredient.plural
    return f"{trim(quantity)} {unit_word} {food}"
