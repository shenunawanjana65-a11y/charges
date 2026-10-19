from decimal import Decimal
from typing import Optional

from django.db.models import Q
from ninja import Router

from .models import OtherCharge
from .schemas import (
    OtherChargeAmountUpdate,
    OtherChargeIn,
    OtherChargeStatusUpdate,
    OtherChargeUpdate,
)

router = Router(tags=['Other Charges'])

VALID_TYPES = {value for value, _ in OtherCharge.TYPE_CHOICES}
VALID_CATEGORIES = {value for value, _ in OtherCharge.CATEGORY_CHOICES}
SORTABLE_FIELDS = {'id', 'name', 'code', 'charge_type', 'amount', 'record_status'}


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
def serialize(charge: OtherCharge) -> dict:
    return {
        'id': charge.id,
        'name': charge.name,
        'code': charge.code,
        'charge_type': charge.charge_type,
        'owner_type': charge.owner_type,
        'category': charge.category,
        'is_rmv': charge.is_rmv,
        'is_pre_disburse': charge.is_pre_disburse,
        'is_post_disburse': charge.is_post_disburse,
        'amount_type': charge.amount_type,
        'amount': float(charge.amount),
        'record_status': charge.record_status,
    }


def fail(message: str) -> dict:
    # the frontend checks response.data.success === false
    return {'success': False, 'error': {'message': message}, 'message': message}


def validate_common(category: str, is_pre: bool, is_post: bool) -> Optional[str]:
    if category not in VALID_CATEGORIES:
        return 'Invalid category.'
    if not (is_pre or is_post):
        return 'Select at least one stage.'
    return None


def validate_amount_and_status(
    amount: Decimal, record_status: int, amount_type: str = 'FIXED'
) -> Optional[str]:
    if amount_type not in {'FIXED', 'PERCENTAGE'}:
        return 'Amount type must be Fixed Amount or Percentage.'
    maximum = (
        Decimal('100')
        if amount_type == 'PERCENTAGE'
        else Decimal('9999999999.99')
    )
    if amount < 0 or amount > maximum:
        return f'Amount must be between 0 and {maximum}.'
    if amount.as_tuple().exponent < -2:
        return 'Amount cannot have more than 2 decimal places.'
    if record_status not in (0, 1):
        return 'Status must be Active or Inactive.'
    return None


# ---------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------


    page = max(page, 1)
    limit = min(max(limit, 1), 100)

    qs = OtherCharge.objects.all()

    if status is not None:
        qs = qs.filter(record_status=status)
    if charge_type:
        qs = qs.filter(charge_type=charge_type)
    if search and search.strip():
        term = search.strip()
        qs = qs.filter(Q(name__icontains=term) | Q(code__icontains=term))

    qs = qs.order_by(sort if sort in SORTABLE_FIELDS else 'id')

    total = qs.count()
    start = (page - 1) * limit
    items = qs[start:start + limit]

    return {
        'data': [serialize(item) for item in items],
        'pagination': {'total': total, 'page': page, 'limit': limit},
    }


@router.post('')
def create_other_charge(request, payload: OtherChargeIn):
    name = payload.name.strip()
    code = payload.code.strip()
    owner_type = payload.owner_type.strip()

    if not name:
        return fail('Name is required.')
    if not code:
        return fail('Code is required.')
    if not owner_type:
        return fail('Owner Type is required.')
    if len(owner_type) > 50:
        return fail('Owner Type cannot exceed 50 characters.')
    error = validate_amount_and_status(payload.amount, 1, payload.amount_type)
    if error:
        return fail(error)
    if payload.charge_type not in VALID_TYPES:
        return fail('Invalid Other Charge Type.')

    error = validate_common(
        payload.category, payload.is_pre_disburse, payload.is_post_disburse
    )
    if error:
        return fail(error)

    if OtherCharge.objects.filter(name__iexact=name).exists():
        return fail('An Other Charge with this name already exists.')
    if OtherCharge.objects.filter(code__iexact=code).exists():
        return fail('An Other Charge with this code already exists.')

    charge = OtherCharge.objects.create(
        name=name,
        code=code,
        charge_type=payload.charge_type,
        owner_type=owner_type,
        amount_type=payload.amount_type,
        amount=payload.amount,
        category=payload.category,
        is_rmv=payload.is_rmv,
        is_pre_disburse=payload.is_pre_disburse,
        is_post_disburse=payload.is_post_disburse,
    )

    return {
        'success': True,
        'message': 'Other Charge created successfully',
        'data': serialize(charge),
    }


@router.put('/{int:charge_id}')
def update_other_charge(request, charge_id: int, payload: OtherChargeUpdate):
    try:
        charge = OtherCharge.objects.get(id=charge_id)
    except OtherCharge.DoesNotExist:
        return fail('Other Charge not found.')

    owner_type = payload.owner_type.strip()
    if not owner_type:
        return fail('Owner Type is required.')
    if len(owner_type) > 50:
        return fail('Owner Type cannot exceed 50 characters.')
    amount = payload.amount if payload.amount is not None else charge.amount
    amount_type = payload.amount_type or charge.amount_type
    error = validate_amount_and_status(
        amount, charge.record_status, amount_type
    )
    if error:
        return fail(error)

    error = validate_common(
        payload.category, payload.is_pre_disburse, payload.is_post_disburse
    )
    if error:
        return fail(error)

    charge.owner_type = owner_type
    if payload.amount_type is not None:
        charge.amount_type = payload.amount_type
    if payload.amount is not None:
        charge.amount = payload.amount
    charge.is_rmv = payload.is_rmv
    charge.category = payload.category
    charge.is_pre_disburse = payload.is_pre_disburse
    charge.is_post_disburse = payload.is_post_disburse
    charge.save()

    return {
        'success': True,
        'message': 'Other Charge updated successfully',
        'data': serialize(charge),
    }


@router.patch('/{int:charge_id}/status')
def update_other_charge_status(
    request, charge_id: int, payload: OtherChargeStatusUpdate
):
    try:
        charge = OtherCharge.objects.get(id=charge_id)
    except OtherCharge.DoesNotExist:
        return fail('Other Charge not found.')

    if payload.record_status not in (0, 1):
        return fail('Status must be Active or Inactive.')

    charge.record_status = payload.record_status
    charge.save(update_fields=['record_status', 'updated_at'])

    return {
        'success': True,
        'message': 'Other Charge status updated successfully',
        'data': serialize(charge),
    }


@router.patch('/{int:charge_id}/amount')
def update_other_charge_amount(
    request, charge_id: int, payload: OtherChargeAmountUpdate
):
    try:
        charge = OtherCharge.objects.get(id=charge_id)
    except OtherCharge.DoesNotExist:
        return fail('Other Charge not found.')

    error = validate_amount_and_status(
        payload.amount, charge.record_status, charge.amount_type
    )
    if error:
        return fail(error)

    charge.amount = payload.amount
    charge.save(update_fields=['amount', 'updated_at'])

    return {
        'success': True,
        'message': 'Other Charge amount updated successfully',
        'data': serialize(charge),
    }


@router.delete('/{int:charge_id}')
def delete_other_charge(request, charge_id: int):
    try:
        charge = OtherCharge.objects.get(id=charge_id)
    except OtherCharge.DoesNotExist:
        return fail('Other Charge not found.')

    charge.delete()
    return {'success': True, 'message': 'Other Charge deleted successfully'}
