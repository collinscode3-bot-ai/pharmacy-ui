import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  MedicineDetailsResponse,
  MedicineService,
  SaleCreateRequest,
  SaleItemCreateRequest
} from '../../services/medicine.service';

interface MedicineCard {
  id: number;
  inventoryId: number | null;
  gstRate: number;
  priceIncludesGst: boolean;
  name: string;
  dose: string;
  packInfo: string;
  brand: string;
  categoryTag: string;
  complianceTag: string;
  stock: number;
  price: number;
  prescriptionOnly: boolean;
  style: 'default' | 'alert' | 'danger';
  icon: string;
}

interface OrderItem extends MedicineCard {
  quantity: number;
}

interface InvoiceDocument {
  fileName?: string;
  contentType?: string;
  base64Content?: string;
  archivePath?: string;
}

@Component({
  selector: 'app-medicines-billing',
  templateUrl: './medicines-billing.component.html',
  styleUrls: ['./medicines-billing.component.scss']
})
export class MedicinesBillingComponent implements OnInit, OnDestroy {
  readonly vatRate = 0.05;
  readonly discountRate = 0.05;
  readonly maxVisibleCards = 16;

  searchTerm = '';
  customDiscount = 0;

  customerName = 'Walk-in Customer';
  customerPhone = '';
  isCustomerModalOpen = false;
  editCustomerName = '';
  editCustomerPhone = '';
  editCustomerNameTouched = false;
  editCustomerPhoneTouched = false;
  discountTouched = false;

  payment = {
    cash: 0,
    card: 0,
    upi: 0
  };

  medicines: MedicineCard[] = [];
  orderItems: OrderItem[] = [];

  isLoadingMedicines = false;
  isSearchingMedicines = false;
  isCompletingSale = false;
  isSaleCompleted = false;
  loadError = '';
  saleError = '';
  saleSuccess = '';
  latestInvoiceDocument: InvoiceDocument | null = null;

  private medicinesRequestSub?: Subscription;

  constructor(private medicineService: MedicineService) {}

  ngOnInit(): void {
    this.loadMedicines();
  }

  ngOnDestroy(): void {
    this.medicinesRequestSub?.unsubscribe();
  }

  get filteredMedicines(): MedicineCard[] {
    return this.medicines;
  }

  get medicinesLoadingMessage(): string {
    return this.isSearchingMedicines ? 'Please wait... searching medicines.' : 'Please wait... loading medicines.';
  }

  get visibleMedicines(): MedicineCard[] {
    return this.filteredMedicines.slice(0, this.maxVisibleCards);
  }

  get subtotal(): number {
    const total = this.orderItems.reduce((sum, item) => sum + this.lineTaxableAmount(item), 0);
    return this.round2(total);
  }

  get taxAmount(): number {
    return this.gstAmount;
  }

  get gstAmount(): number {
    const total = this.orderItems.reduce((sum, item) => sum + this.lineGstAmount(item), 0);
    return this.round2(total);
  }

  get grossAmount(): number {
    const total = this.orderItems.reduce((sum, item) => sum + this.lineGrossAmount(item), 0);
    return this.round2(total);
  }

  get maxDiscountAllowed(): number {
    return this.round2(this.grossAmount * this.discountRate);
  }

  get bulkDiscount(): number {
    const discount = this.toNumber(this.customDiscount);
    return this.round2(Math.min(Math.max(discount, 0), this.maxDiscountAllowed));
  }

  get grandTotal(): number {
    return this.round2(this.subtotal + this.gstAmount - this.bulkDiscount);
  }

  get canCompleteSale(): boolean {
    return this.orderItems.length > 0 && !this.isCompletingSale && !this.isSaleCompleted;
  }

  get hasOrderItemWithoutInventory(): boolean {
    return this.orderItems.some((item) => !item.inventoryId);
  }

  get customerPhoneLabel(): string {
    return this.customerPhone?.trim() || 'Phone not added';
  }

  get isCustomerNameValid(): boolean {
    return !!this.editCustomerName && this.editCustomerName.trim().length > 0;
  }

  get isDiscountValid(): boolean {
    // customDiscount must be >= 0 and not exceed configured cap on gross bill amount.
    const max = this.maxDiscountAllowed;
    const discount = this.toNumber(this.customDiscount);
    return discount >= 0 && discount <= max + 1e-9;
  }

  get isCustomerPhoneValid(): boolean {
    if (!this.editCustomerPhone) return true;
    const digits = String(this.editCustomerPhone).replace(/\D/g, '');
    return digits.length === 10;
  }

  clearOrder(clearInvoice = true): void {
    this.orderItems = [];
    this.payment = { cash: 0, card: 0, upi: 0 };
    this.customDiscount = 0;
    if (clearInvoice) {
      this.latestInvoiceDocument = null;
    }
  }

  startNewBill(): void {
    this.clearOrder();
    this.searchTerm = '';
    this.customerName = 'Walk-in Customer';
    this.customerPhone = '';
    this.isCustomerModalOpen = false;
    this.editCustomerName = '';
    this.editCustomerPhone = '';
    this.editCustomerNameTouched = false;
    this.editCustomerPhoneTouched = false;
    this.discountTouched = false;
    this.isSaleCompleted = false;
    this.saleError = '';
    this.saleSuccess = '';
    this.loadError = '';
    this.loadMedicines();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value ?? '';
    this.loadMedicines(this.searchTerm);
  }

  openCustomerEditModal(): void {
    this.editCustomerName = this.customerName;
    this.editCustomerPhone = this.customerPhone;
    this.isCustomerModalOpen = true;
  }

  closeCustomerEditModal(): void {
    this.isCustomerModalOpen = false;
  }

  saveCustomerDetails(): void {
    this.customerName = this.editCustomerName?.trim() || 'Walk-in Customer';
    this.customerPhone = this.editCustomerPhone?.trim() || '';
    this.isCustomerModalOpen = false;
  }

  addToOrder(medicine: MedicineCard): void {
    if (medicine.stock <= 0) {
      return;
    }

    this.isSaleCompleted = false;
    this.saleError = '';
    this.saleSuccess = '';

    const existing = this.orderItems.find((item) => item.id === medicine.id);
    if (existing) {
      this.increment(existing);
      return;
    }

    this.orderItems = [...this.orderItems, this.withQuantity(medicine, 1)];
  }

  increment(item: OrderItem): void {
    this.isSaleCompleted = false;
    const source = this.medicines.find((medicine) => medicine.id === item.id);
    const maxStock = source?.stock ?? item.stock;

    if (item.quantity >= maxStock) {
      return;
    }

    item.quantity += 1;
  }

  decrement(item: OrderItem): void {
    this.isSaleCompleted = false;
    if (item.quantity <= 1) {
      this.removeLine(item);
      return;
    }

    item.quantity -= 1;
  }

  removeLine(item: OrderItem): void {
    this.isSaleCompleted = false;
    this.orderItems = this.orderItems.filter((line) => line.id !== item.id);
  }

  submitSale(): void {
    if (!this.canCompleteSale || this.isCompletingSale) {
      return;
    }

    const request = this.buildSaleCreateRequest();
    console.log('Complete Sale payload (JSON):\n' + JSON.stringify(request, null, 2));

    if (!request.items.length) {
      this.saleError = 'Could not complete sale. Add at least one item to the order.';
      return;
    }

    this.isCompletingSale = true;
    this.saleError = '';
    this.saleSuccess = '';
    this.latestInvoiceDocument = null;

    this.medicineService.createSale(request).subscribe({
      next: (response: any) => {
        this.captureInvoiceDocument(response);
        this.saleSuccess = this.latestInvoiceDocument
          ? 'Sale completed successfully. Invoice is ready to download.'
          : 'Sale completed successfully.';
        this.isSaleCompleted = true;
        this.clearOrder(false);
        this.loadMedicines(this.searchTerm);
      },
      error: () => {
        this.saleError = 'Failed to complete sale. Please try again.';
        this.isCompletingSale = false;
      },
      complete: () => {
        this.isCompletingSale = false;
      }
    });
  }

  trackByMedicine(_: number, medicine: MedicineCard): number {
    return medicine.id;
  }

  trackByOrder(_: number, item: OrderItem): number {
    return item.id;
  }

  get hasInvoiceDocument(): boolean {
    return !!this.latestInvoiceDocument?.base64Content;
  }

  downloadInvoice(): void {
    const doc = this.latestInvoiceDocument;
    if (!doc?.base64Content) {
      this.saleError = 'Invoice PDF is not available for download.';
      return;
    }

    const base64 = doc.base64Content.includes(',')
      ? doc.base64Content.split(',').pop() || ''
      : doc.base64Content;

    if (!base64) {
      this.saleError = 'Invoice PDF content is empty.';
      return;
    }

    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const fileName = (doc.fileName || `invoice_${Date.now()}.pdf`).trim();
      const contentType = (doc.contentType || 'application/pdf').trim();
      const blob = new Blob([bytes], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      this.saleError = 'Unable to decode invoice PDF from API response.';
    }
  }

  private loadMedicines(startsWith?: string): void {
    this.medicinesRequestSub?.unsubscribe();

    const prefix = startsWith?.trim() || '';
    this.isLoadingMedicines = true;
    this.isSearchingMedicines = prefix.length > 0;
    this.loadError = '';

    this.medicinesRequestSub = this.medicineService.getMedicinesAlpha(prefix).subscribe({
      next: (rows) => {
        this.medicines = rows
          .map((row, index) => this.toMedicineCard(row, index))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, this.maxVisibleCards);
      },
      error: () => {
        this.medicines = [];
        this.loadError = 'Unable to load medicines at the moment.';
        this.isLoadingMedicines = false;
        this.isSearchingMedicines = false;
      },
      complete: () => {
        this.isLoadingMedicines = false;
        this.isSearchingMedicines = false;
      }
    });
  }

  private buildSaleCreateRequest(): SaleCreateRequest {
    const items: SaleItemCreateRequest[] = this.orderItems.map((item) => ({
      medicineId: this.toInt(item.id),
      inventoryId: item.inventoryId == null ? null : this.toInt(item.inventoryId),
      quantity: this.toInt(item.quantity)
    }));

    const orderContext = this.orderItems.map((item) => ({
      medicineId: this.toInt(item.id),
      inventoryId: item.inventoryId == null ? null : this.toInt(item.inventoryId),
      medicineName: String(item.name || ''),
      dose: String(item.dose || ''),
      unitPrice: this.round2(this.toNumber(item.price)),
      isTaxInclusivePrice: !!item.priceIncludesGst,
      gstRate: this.round2(item.gstRate * 100),
      gstAmount: this.lineGstAmount(item),
      quantity: this.toInt(item.quantity),
      lineTaxableAmount: this.lineTaxableAmount(item),
      lineGrossAmount: this.lineGrossAmount(item),
      lineAmount: this.lineGrossAmount(item)
    }));

    const request: SaleCreateRequest = {
      customerName: this.customerName?.trim() || 'Walk-in Customer',
      paymentMethod: this.resolvePaymentMethod(),
      items,
      subtotalAmount: this.round2(this.subtotal),
      discountAmount: this.round2(this.bulkDiscount),
      gstAmount: this.round2(this.gstAmount),
      grandTotalAmount: this.round2(this.grandTotal),
      paymentBreakdown: {
        cash: this.round2(this.toNumber(this.payment.cash)),
        card: this.round2(this.toNumber(this.payment.card)),
        upi: this.round2(this.toNumber(this.payment.upi))
      },
      orderContext
    };

    const customerPhone = this.customerPhone?.trim();
    if (customerPhone) {
      request.customerPhone = customerPhone;
    }

    return request;
  }

  private captureInvoiceDocument(response: any): void {
    const invoiceDocument = response?.invoiceDocument;
    if (!invoiceDocument || typeof invoiceDocument !== 'object') {
      this.latestInvoiceDocument = null;
      return;
    }

    this.latestInvoiceDocument = {
      fileName: typeof invoiceDocument.fileName === 'string' ? invoiceDocument.fileName : undefined,
      contentType: typeof invoiceDocument.contentType === 'string' ? invoiceDocument.contentType : undefined,
      base64Content: typeof invoiceDocument.base64Content === 'string' ? invoiceDocument.base64Content : undefined,
      archivePath: typeof invoiceDocument.archivePath === 'string' ? invoiceDocument.archivePath : undefined
    };
  }

  private toMedicineCard(row: MedicineDetailsResponse, index: number): MedicineCard {
    const inv = row.inventories?.[0];
    const inventoryId = this.toPositiveInt(inv?.inventoryId ?? inv?.id);
    const stock = this.toInt(inv?.quantityOnHand ?? inv?.quantity);
    const price = this.toNumber(inv?.sellingPrice ?? inv?.purchasePrice);
    const gstRate = this.resolveGstRate(row);
    const priceIncludesGst = this.resolvePriceIncludesGst(row, inv);
    const prescriptionOnly = !!row.isPrescriptionRequired;
    const productType = (row.productType || 'Medicine').trim();

    return {
      id: this.toInt(row.medicineId ?? row.id ?? (index + 1)),
      inventoryId,
      gstRate,
      priceIncludesGst,
      name: (row.name || 'Unnamed Medicine').trim(),
      dose: (row.strength || row.dosageForm || '').trim(),
      packInfo: stock > 0 ? `${stock} Units` : '0 Units',
      brand: (row.manufacturer || row.genericName || '-').trim(),
      categoryTag: productType,
      complianceTag: inv?.batchNumber ? `Batch: ${inv.batchNumber}` : (row.taxName || 'General'),
      stock,
      price,
      prescriptionOnly,
      style: stock === 0 ? 'danger' : (prescriptionOnly ? 'alert' : 'default'),
      icon: this.resolveIcon(productType, prescriptionOnly)
    };
  }

  private resolveIcon(productType: string, prescriptionOnly: boolean): string {
    const type = productType.toLowerCase();
    if (type.includes('surgical')) {
      return 'medical_services';
    }
    if (prescriptionOnly) {
      return 'vaccines';
    }
    return 'medication';
  }

  private withQuantity(medicine: MedicineCard, quantity: number): OrderItem {
    return {
      ...medicine,
      quantity
    };
  }

  private lineGrossAmount(item: OrderItem): number {
    return this.round2(this.toNumber(item.price) * this.toInt(item.quantity));
  }

  private lineTaxableAmount(item: OrderItem): number {
    const gross = this.lineGrossAmount(item);
    const rate = this.toNumber(item.gstRate);

    if (item.priceIncludesGst) {
      return this.round2(gross / (1 + rate));
    }

    return gross;
  }

  private lineGstAmount(item: OrderItem): number {
    const taxable = this.lineTaxableAmount(item);
    const gross = this.lineGrossAmount(item);

    if (item.priceIncludesGst) {
      return this.round2(gross - taxable);
    }

    return this.round2(taxable * this.toNumber(item.gstRate));
  }

  private resolvePriceIncludesGst(row: MedicineDetailsResponse, inventory?: unknown): boolean {
    const rowModel = row as MedicineDetailsResponse & {
      priceIncludesGst?: boolean | string;
      isTaxInclusive?: boolean | string;
      gstInclusive?: boolean | string;
    };

    const invModel = (inventory as {
      priceIncludesGst?: boolean | string;
      isTaxInclusive?: boolean | string;
      gstInclusive?: boolean | string;
    } | undefined);

    const raw =
      invModel?.priceIncludesGst ??
      invModel?.isTaxInclusive ??
      invModel?.gstInclusive ??
      rowModel.priceIncludesGst ??
      rowModel.isTaxInclusive ??
      rowModel.gstInclusive;

    if (raw == null || raw === '') {
      // Pharmacy retail pricing is typically MRP-inclusive; use this as safe default.
      return true;
    }

    if (typeof raw === 'boolean') {
      return raw;
    }

    const value = String(raw).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'inclusive', 'incl'].includes(value)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'exclusive', 'excl'].includes(value)) {
      return false;
    }

    return true;
  }

  private resolveGstRate(row: MedicineDetailsResponse): number {
    const model = row as MedicineDetailsResponse & {
      gstRate?: number | string;
      gstPercentage?: number | string;
      taxRate?: number | string;
      taxPercentage?: number | string;
    };

    const rawRate = model.gstRate ?? model.gstPercentage ?? model.taxRate ?? model.taxPercentage;
    const numericRate = this.toRate(rawRate);
    if (numericRate != null) {
      return numericRate;
    }

    const percentMatch = String(row.taxName || '').match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch?.[1]) {
      return this.toRate(percentMatch[1]) ?? this.vatRate;
    }

    return this.vatRate;
  }

  private toRate(value: unknown): number | null {
    if (value == null || value === '') {
      return null;
    }

    const n = Number(String(value).replace('%', '').trim());
    if (!Number.isFinite(n)) {
      return null;
    }

    const rate = n > 1 ? n / 100 : n;
    if (rate < 0) {
      return 0;
    }
    if (rate > 1) {
      return 1;
    }
    return rate;
  }

  private resolvePaymentMethod(): string {
    const activeMethods: string[] = [];

    if (this.toNumber(this.payment.cash) > 0) {
      activeMethods.push('CASH');
    }
    if (this.toNumber(this.payment.card) > 0) {
      activeMethods.push('CARD');
    }
    if (this.toNumber(this.payment.upi) > 0) {
      activeMethods.push('UPI');
    }

    if (activeMethods.length === 0) {
      return 'CASH';
    }
    if (activeMethods.length === 1) {
      return activeMethods[0];
    }
    return 'SPLIT';
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toInt(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  private toPositiveInt(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return null;
    }
    const i = Math.floor(n);
    return i > 0 ? i : null;
  }
}
