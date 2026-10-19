from django.db import models


class OtherCharge(models.Model):
    # ids must match otherChargeTypes in other-charge-form.tsx
    TYPE_CHOICES = [
        ('COMMISSION', 'Commission'),
        ('INSURANCE', 'Insurance'),
        ('COMMON', 'Common'),
        ('VEHICLE_RELATED', 'Vehicle Related'),
    ]

    # ids must match otherChargeCategories in other-charge-form.tsx
    CATEGORY_CHOICES = [
        ('OPEN_PAPERS', 'Open Papers'),
        ('BOOK_OWNER', 'Book Owner'),
        ('GENERAL', 'General'),
    ]

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    charge_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    owner_type = models.CharField(max_length=50, blank=True, default='')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    is_rmv = models.BooleanField(default=False)
    is_pre_disburse = models.BooleanField(default=False)
    is_post_disburse = models.BooleanField(default=False)
    amount_type = models.CharField(
        max_length=10,
        choices=[('FIXED', 'Fixed Amount'), ('PERCENTAGE', 'Percentage')],
        default='FIXED',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    record_status = models.IntegerField(default=1)  # 1 = Active, 0 = Inactive
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'other_charges'
        ordering = ['id']

    def __str__(self):
        return f'{self.code} - {self.name}'
