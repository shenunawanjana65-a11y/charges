from decimal import Decimal
from typing import Optional

from ninja import Schema


class OtherChargeIn(Schema):
    name: str
    code: str
    charge_type: str
    owner_type: str
    amount_type: str = 'FIXED'
    amount: Decimal = Decimal('0.00')
    is_rmv: bool = False
    category: str
    is_pre_disburse: bool = False
    is_post_disburse: bool = False


class OtherChargeUpdate(Schema):
    # name, code and charge_type cannot be edited after saving.
    owner_type: str
    amount_type: Optional[str] = None
    amount: Optional[Decimal] = None
    is_rmv: bool = False
    category: str
    is_pre_disburse: bool = False
    is_post_disburse: bool = False


class OtherChargeStatusUpdate(Schema):
    record_status: int


class OtherChargeAmountUpdate(Schema):
    amount: Decimal
