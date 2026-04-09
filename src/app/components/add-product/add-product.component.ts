import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CreateMedicineRequest, InventoryCreateDTO, MedicineDetailsResponse, MedicineService } from '../../services/medicine.service';

@Component({
  selector: 'app-add-product',
  templateUrl: './add-product.component.html',
  styleUrls: ['./add-product.component.scss']
})
export class AddProductComponent implements OnInit {
  // basic model for the form
  product = {
    name: '',
    genericName: '',
    category: '',
    manufacturer: '',
    batch_number: '',
    location: '',
    expiration_date: '',
    reorder_level: '',
    strength: '',
    unitType: '',
    purchasing_unit_price: '',
    selling_unit_price: '',
    quantity_on_hand: '',
    gstTaxId: '' as number | ''
  };

  submitted = false;
  saving = false;
  saveError = '';
  saveSuccess = '';
  editMode = false;
  medicineId: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private medicineService: MedicineService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (Number.isFinite(id) && id > 0) {
      this.editMode = true;
      this.medicineId = id;
      this.loadMedicineForEdit(id);
    }
  }

  get pageTitle(): string {
    return this.editMode ? 'Edit Product' : 'Add New Product';
  }

  get saveButtonText(): string {
    if (this.saving) return this.editMode ? 'Updating...' : 'Saving...';
    return this.editMode ? 'Update' : 'Save Medicine';
  }

  cancel() {
    this.router.navigate(['/medicine-catalog']);
  }

  save(form?: NgForm) {
    this.submitted = true;
    if (form && form.invalid) return;

    const payload = this.buildPayload();
    this.saving = true;
    this.saveError = '';
    this.saveSuccess = '';

    if (this.editMode && this.medicineId) {
      payload.medicineId = this.medicineId;
    }

    const request$ = (this.editMode && this.medicineId)
      ? this.medicineService.updateMedicine(this.medicineId, payload)
      : this.medicineService.createMedicine(payload);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.saveSuccess = this.editMode
          ? 'Product updated successfully. Redirecting to medicine catalog...'
          : 'Product saved successfully. Redirecting to medicine catalog...';
        setTimeout(() => {
          this.router.navigate(['/medicine-catalog']);
        }, 2000);
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err?.error?.message || 'Failed to save medicine. Please try again.';
      }
    });
  }

  private loadMedicineForEdit(id: number) {
    this.medicineService.getMedicineById(id).subscribe({
      next: (res) => this.patchForm(res),
      error: (err) => {
        this.saveError = err?.error?.message || 'Unable to load product details for editing.';
      }
    });
  }

  private patchForm(res: MedicineDetailsResponse) {
    const inv = (res.inventories && res.inventories.length ? res.inventories[0] : {}) as InventoryCreateDTO;
    this.product.name = res.name ?? '';
    this.product.genericName = res.genericName ?? '';
    this.product.category = res.productType ?? '';
    this.product.manufacturer = res.manufacturer ?? '';
    this.product.batch_number = inv.batchNumber ?? '';
    this.product.location = inv.location ?? '';
    const expiration = inv.expirationDate ?? inv.expiryDate;
    this.product.expiration_date = expiration ? String(expiration).slice(0, 10) : '';
    this.product.reorder_level = res.reorderLevel != null ? String(res.reorderLevel) : '';
    this.product.strength = res.strength ?? '';
    this.product.unitType = res.dosageForm ?? '';
    this.product.purchasing_unit_price = inv.purchasePrice != null ? String(inv.purchasePrice) : '';
    this.product.selling_unit_price = inv.sellingPrice != null ? String(inv.sellingPrice) : '';
    const quantity = inv.quantityOnHand ?? inv.quantity;
    this.product.quantity_on_hand = quantity != null ? String(quantity) : '';
    this.product.gstTaxId = res.taxId ?? '';
  }

  private buildPayload(): CreateMedicineRequest {
    const taxId = this.toInt(this.product.gstTaxId) ?? 2;
    const taxNameMap: Record<number, string> = {
      1: '5%',
      2: '12%',
      6: '18%'
    };
    const inventory: InventoryCreateDTO = {
      batchNumber: this.trimOrUndefined(this.product.batch_number),
      location: this.trimOrUndefined(this.product.location),
      expirationDate: this.trimOrUndefined(this.product.expiration_date),
      quantityOnHand: this.toInt(this.product.quantity_on_hand),
      purchasePrice: this.toNumber(this.product.purchasing_unit_price),
      sellingPrice: this.toNumber(this.product.selling_unit_price)
    };

    return {
      name: this.product.name.trim(),
      productType: this.trimOrUndefined(this.product.category),
      genericName: this.trimOrUndefined(this.product.genericName),
      manufacturer: this.trimOrUndefined(this.product.manufacturer),
      strength: this.trimOrUndefined(this.product.strength),
      dosageForm: this.trimOrUndefined(this.product.unitType),
      reorderLevel: this.toInt(this.product.reorder_level),
      isPrescriptionRequired: this.product.category === 'Medicine',
      taxId,
      taxName: taxNameMap[taxId],
      inventories: [inventory]
    };
  }

  private trimOrUndefined(value: string | null | undefined): string | undefined {
    const v = (value ?? '').trim();
    return v.length ? v : undefined;
  }

  private toInt(value: string | number | null | undefined): number | undefined {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    return Number.isInteger(n) ? n : undefined;
  }

  private toNumber(value: string | number | null | undefined): number | undefined {
    if (value == null || value === '') return undefined;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
}
