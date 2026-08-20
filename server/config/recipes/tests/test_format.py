from decimal import Decimal
from types import SimpleNamespace

from recipes.format import format_quantity

pound = SimpleNamespace(name="pound", plural="pounds", takes_of=True)
whole = SimpleNamespace(name="whole", plural="whole", takes_of=False)
cup = SimpleNamespace(name="cup", plural="cups", takes_of=True)

beef = SimpleNamespace(name="beef", plural="beef")
orange = SimpleNamespace(name="orange", plural="oranges")
flour = SimpleNamespace(name="flour", plural="flour")


def test_plural_unit_takes_of():
    assert format_quantity(Decimal(2), pound, beef) == "2 pounds of beef"


def test_singular_unit_takes_of():
    assert format_quantity(Decimal(1), pound, beef) == "1 pound of beef"


def test_plural_unit_no_of():
    assert format_quantity(Decimal(3), whole, orange) == "3 whole oranges"


def test_singular_unit_no_of():
    assert format_quantity(Decimal(1), whole, orange) == "1 whole orange"


def test_decimal_quantity():
    assert format_quantity(Decimal("0.5"), cup, flour) == "0.5 cups of flour"


def test_trims_trailing_zeros():
    assert format_quantity(Decimal("5.000"), pound, beef) == "5 pounds of beef"
