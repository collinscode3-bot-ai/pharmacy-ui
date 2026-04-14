import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CreateMedicineRequest, InventoryCreateDTO, MedicineDetailsResponse, MedicineService } from '../../services/medicine.service';

interface InventoryRowForm {
  inventoryId?: number;
  batchNumber: string;
  expirationDate: string;
  location: string;
  purchasingUnitPrice: string;
  sellingUnitPrice: string;
  quantity: string;
}

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
    reorder_level: '',
    strength: '',
    unitType: '',
    gstTaxId: '' as number | '',
    isPrescriptionRequired: false
  };

  inventoryRows: InventoryRowForm[] = [this.createEmptyInventoryRow()];

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

  addInventoryRow() {
    this.inventoryRows = [...this.inventoryRows, this.createEmptyInventoryRow()];
  }

  removeInventoryRow(index: number) {
    if (this.inventoryRows.length <= 1) {
      return;
    }

    this.inventoryRows = this.inventoryRows.filter((_, i) => i !== index);
  }

  trackInventoryRow(index: number) {
    return index;
  }

  save(form?: NgForm) {
    this.submitted = true;
    this.saveError = '';
    this.saveSuccess = '';

    if (form && form.invalid) {
      this.saveError = 'Please complete all required fields before saving.';
      return;
    }

    if (!this.inventoryRows.length) {
      this.saveError = 'At least one inventory row is required.';
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;

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
    const inventories = (res.inventories && res.inventories.length ? res.inventories : [{} as InventoryCreateDTO]);
    this.product.name = res.name ?? '';
    this.product.genericName = res.genericName ?? '';
    this.product.category = res.productType ?? '';
    this.product.manufacturer = res.manufacturer ?? '';
    this.product.reorder_level = res.reorderLevel != null ? String(res.reorderLevel) : '';
    this.product.strength = res.strength ?? '';
    this.product.unitType = res.dosageForm ?? '';
    this.product.gstTaxId = res.taxId ?? '';
    this.product.isPrescriptionRequired = this.toBoolean(res.isPrescriptionRequired);

    this.inventoryRows = inventories.map((inv) => {
      const expiration = inv.expirationDate ?? inv.expiryDate;
      const quantity = inv.quantityOnHand ?? inv.quantity;

      return {
        inventoryId: this.toPositiveInt(inv.inventoryId ?? inv.id),
        batchNumber: inv.batchNumber ?? '',
        expirationDate: expiration ? String(expiration).slice(0, 10) : '',
        location: inv.location ?? '',
        purchasingUnitPrice: inv.purchasePrice != null ? String(inv.purchasePrice) : '',
        sellingUnitPrice: inv.sellingPrice != null ? String(inv.sellingPrice) : '',
        quantity: quantity != null ? String(quantity) : ''
      };
    });
  }

  private buildPayload(): CreateMedicineRequest {
    const taxId = this.toInt(this.product.gstTaxId) ?? 2;
    const taxNameMap: Record<number, string> = {
      1: '5%',
      2: '12%',
      6: '18%'
    };
    const inventories: InventoryCreateDTO[] = this.inventoryRows.map((row) => {
      const inventoryId = this.toPositiveInt(row.inventoryId);

      return {
        inventoryId,
        batchNumber: this.trimOrUndefined(row.batchNumber),
        location: this.trimOrUndefined(row.location),
        expirationDate: this.trimOrUndefined(row.expirationDate),
        quantityOnHand: this.toInt(row.quantity),
        purchasePrice: this.toNumber(row.purchasingUnitPrice),
        sellingPrice: this.toNumber(row.sellingUnitPrice)
      };
    });

    return {
      name: this.product.name.trim(),
      productType: this.trimOrUndefined(this.product.category),
      genericName: this.trimOrUndefined(this.product.genericName),
      manufacturer: this.trimOrUndefined(this.product.manufacturer),
      strength: this.trimOrUndefined(this.product.strength),
      dosageForm: this.trimOrUndefined(this.product.unitType),
      reorderLevel: this.toInt(this.product.reorder_level),
      isPrescriptionRequired: this.product.isPrescriptionRequired ? 1 : 0,
      taxId,
      taxName: taxNameMap[taxId],
      inventories
    };
  }

  private trimOrUndefined(value: string | null | undefined): string | undefined {
    const v = (value ?? '').trim();
    return v.length ? v : undefined;
  }

  private createEmptyInventoryRow(): InventoryRowForm {
    return {
      batchNumber: '',
      expirationDate: '',
      location: '',
      purchasingUnitPrice: '',
      sellingUnitPrice: '',
      quantity: ''
    };
  }

  private toPositiveInt(value: string | number | null | undefined): number | undefined {
    const n = this.toInt(value);
    return n != null && n > 0 ? n : undefined;
  }

  private toBoolean(value: boolean | number | null | undefined): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    return value === 1;
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
