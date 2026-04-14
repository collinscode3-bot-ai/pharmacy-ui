import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

type DeliveryStatus = 'in_transit' | 'pending' | 'delivered' | 'delayed';
type StatusMessageType = 'success' | 'error' | 'info';
type ReceiptDeliveryStatus =
  | 'RECEIVED'
  | 'DAMAGED'
  | 'SHORT_SHIPPED'
  | 'OVER_SHIPPED'
  | 'EXPIRED_ON_ARRIVAL'
  | 'PARTIALLY_RECEIVED';

interface DeliveryLineItem {
  purchaseItemId: number | null;
  productName: string;
  sku: string;
  orderedUnits: number;
  batchNo: string;
  expiryDate: string;
  purchasePrice: number;
  sellPrice: number;
  receivedUnits: number;
  deliveryStatus: ReceiptDeliveryStatus | '';
}

interface PurchaseReceiptLineItemPayload {
  purchaseItemId: number;
  quantityReceived: number;
  batchNumber: string;
  expirationDate: string;
  unitPrice: number;
  sellingPrice: number;
  deliveryStatus: ReceiptDeliveryStatus;
  isActive: boolean;
}

interface PurchaseReceiptCreatePayload {
  purchaseId: number;
  receiptDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceImageBase64: string;
  notes: string;
  isActive: boolean;
  items: PurchaseReceiptLineItemPayload[];
}

@Component({
  selector: 'app-receive-delivery',
  templateUrl: './receive-delivery.component.html',
  styleUrls: ['./receive-delivery.component.scss']
})
export class ReceiveDeliveryComponent implements OnInit {
  purchaseId: number | null = null;
  poNumber = '';
  orderDate = '';
  supplierName = '';
  currentStatus: DeliveryStatus = 'in_transit';
  loadingPurchaseDetails = false;
  savingReceipt = false;

  lineItems: DeliveryLineItem[] = [];

  invoiceNumber = '';
  invoiceDate = '';
  remarks = '';
  selectedInvoiceName = '';
  selectedInvoiceBase64 = '';
  submitAttempted = false;
  invoiceUploadTouched = false;
  invoiceReading = false;
  invoiceReadError = '';

  statusMessage = '';
  statusMessageType: StatusMessageType = 'info';

  readonly deliveryStatusOptions: ReadonlyArray<ReceiptDeliveryStatus> = [
    'RECEIVED',
    'DAMAGED',
    'SHORT_SHIPPED',
    'OVER_SHIPPED',
    'EXPIRED_ON_ARRIVAL',
    'PARTIALLY_RECEIVED'
  ];

  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.initializeOrderDetails();

    this.route.paramMap.subscribe((params) => {
      const routePoNumber = params.get('poNumber');
      const resolvedPoNumber = String(routePoNumber ?? this.poNumber ?? '').trim();

      if (!resolvedPoNumber) {
        this.initializeLineItems();
        return;
      }

      this.poNumber = resolvedPoNumber;
      this.loadPurchaseDetails(resolvedPoNumber);
    });
  }

  get pendingReceiptCount(): number {
    return this.lineItems.filter((item) => item.receivedUnits < item.orderedUnits).length;
  }

  get currentStatusLabel(): string {
    if (this.currentStatus === 'in_transit') {
      return 'In Transit';
    }

    if (this.currentStatus === 'delivered') {
      return 'Delivered';
    }

    if (this.currentStatus === 'delayed') {
      return 'Delayed';
    }

    return 'Pending';
  }

  get statusClass(): string {
    return `status-pill ${this.currentStatus}`;
  }

  get showInvoiceUploadError(): boolean {
    return (this.invoiceUploadTouched || this.submitAttempted) && !this.selectedInvoiceBase64;
  }

  get statusMessageClass(): string {
    return `status-note ${this.statusMessageType}`;
  }

  get showInvoiceReadError(): boolean {
    return !!this.invoiceReadError;
  }

  onInvoiceSelected(event: Event): void {
    this.invoiceUploadTouched = true;
    this.invoiceReadError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;

    if (!file) {
      this.selectedInvoiceName = '';
      this.selectedInvoiceBase64 = '';
      return;
    }

    this.selectedInvoiceName = file.name;
    this.invoiceReading = true;

    this.fileToBase64(file)
      .then((base64) => {
        this.selectedInvoiceBase64 = base64;
      })
      .catch(() => {
        this.selectedInvoiceBase64 = '';
        this.selectedInvoiceName = '';
        this.invoiceReadError = 'Unable to read selected invoice file.';
      })
      .finally(() => {
        this.invoiceReading = false;
      });
  }

  backToTracking(): void {
    this.router.navigate(['/inventory/purchase-order-tracking']);
  }

  acceptDelivery(receiveForm: NgForm): void {
    if (this.savingReceipt) {
      return;
    }

    this.submitAttempted = true;
    this.invoiceUploadTouched = true;

    if (!this.isFormValid(receiveForm)) {
      this.statusMessageType = 'error';
      this.statusMessage = 'Please complete all mandatory fields before accepting delivery.';
      return;
    }

    const missingPurchaseItem = this.lineItems.find((item) => item.purchaseItemId == null);
    if (missingPurchaseItem) {
      this.statusMessageType = 'error';
      this.statusMessage = `Unable to save receipt. Missing purchase item id for ${missingPurchaseItem.productName}.`;
      return;
    }

    if (this.purchaseId == null) {
      this.statusMessageType = 'error';
      this.statusMessage = 'Unable to save receipt. Purchase id was not resolved for this purchase order.';
      return;
    }

    const payload = this.buildPurchaseReceiptPayload();
    this.savingReceipt = true;
    this.statusMessageType = 'info';
    this.statusMessage = '';

    this.http.post<any>(API_ENDPOINTS.PURCHASE_RECEIPTS.CREATE, payload).subscribe({
      next: (res) => {
        this.statusMessageType = 'success';
        this.statusMessage = this.extractApiSuccessMessage(res) || 'Purchase receipt saved successfully.';
      },
      error: (err) => {
        this.statusMessageType = 'error';
        this.statusMessage = this.extractApiErrorMessage(err) || 'Unable to save purchase receipt. Please try again.';
      },
      complete: () => {
        this.savingReceipt = false;
      }
    });
  }

  isFormValid(receiveForm: NgForm | null): boolean {
    if (!receiveForm) {
      return false;
    }

    return !!receiveForm.valid && !!this.selectedInvoiceBase64 && !this.invoiceReading;
  }

  private initializeOrderDetails(): void {
    const poNumberFromRoute = this.route.snapshot.paramMap.get('poNumber');
    const navState = this.router.getCurrentNavigation()?.extras?.state;
    const state = navState || history.state;

    this.purchaseId = this.toNullableNumber(state?.purchaseId ?? state?.purchase?.id ?? state?.poNumber);
    this.poNumber = String(state?.poNumber ?? poNumberFromRoute ?? 'PO-2023-088');
    this.orderDate = this.toDisplayDate(state?.poDate) || 'Oct 24, 2023';
    this.supplierName = String(state?.supplierName ?? 'Global Med Distribution');
    this.currentStatus = this.toDeliveryStatus(state?.statusLabel ?? state?.statusKey ?? 'in_transit');
  }

  private initializeLineItems(): void {
    this.lineItems = this.getFallbackLineItems();
  }

  private getFallbackLineItems(): DeliveryLineItem[] {
    return [
    ];
  }

  private loadPurchaseDetails(poNumber: string): void {
    if (!poNumber) {
      this.initializeLineItems();
      return;
    }

    this.loadingPurchaseDetails = true;

    this.http.get<any>(API_ENDPOINTS.PURCHASES.DETAILS(poNumber)).subscribe({
      next: (res) => {
        const details = this.extractEntity(res);

        if (!details) {
          this.initializeLineItems();
          this.loadingPurchaseDetails = false;
          return;
        }

        this.applyPurchaseDetails(details);
        this.loadingPurchaseDetails = false;
      },
      error: () => {
        this.initializeLineItems();
        this.statusMessageType = 'error';
        this.statusMessage = 'Unable to load purchase details right now. Showing preview data.';
        this.loadingPurchaseDetails = false;
      }
    });
  }

  private applyPurchaseDetails(details: any): void {
    this.purchaseId = this.toNullableNumber(details?.purchaseId ?? details?.id ?? details?.purchase?.id ?? this.purchaseId);
    this.poNumber = String(details?.poNumber ?? details?.purchaseOrderNo ?? details?.orderNo ?? this.poNumber);
    this.orderDate = this.toDisplayDate(details?.purchaseDate ?? details?.orderDate ?? details?.createdAt) || this.orderDate;
    this.supplierName = String(
      details?.supplierName ?? details?.supplier?.supplierName ?? details?.vendorName ?? this.supplierName
    );
    this.currentStatus = this.toDeliveryStatus(details?.orderStatus ?? details?.status ?? details?.state ?? this.currentStatus);

    const items = this.extractLineItems(details)
      .map((item: any, index: number) => this.normalizeLineItem(item, index))
      .filter((item: DeliveryLineItem) => !!item.productName);

    this.lineItems = items.length ? items : this.getFallbackLineItems();
  }

  private extractEntity(res: any): any {
    if (res == null) {
      return null;
    }

    if (Array.isArray(res) && res.length > 0) {
      return res[0];
    }

    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      return res.data;
    }

    if (res?.content && typeof res.content === 'object' && !Array.isArray(res.content)) {
      return res.content;
    }

    if (typeof res === 'object') {
      return res;
    }

    return null;
  }

  private extractLineItems(details: any): any[] {
    if (Array.isArray(details?.items)) {
      return details.items;
    }

    if (Array.isArray(details?.lineItems)) {
      return details.lineItems;
    }

    if (Array.isArray(details?.purchaseItems)) {
      return details.purchaseItems;
    }

    if (Array.isArray(details?.itemDetails)) {
      return details.itemDetails;
    }

    if (Array.isArray(details?.details)) {
      return details.details;
    }

    return [];
  }

  private normalizeLineItem(row: any, index: number): DeliveryLineItem {
    const orderedUnits = this.toInt(
      row?.orderedQuantity ??
      row?.quantityOrdered ??
      row?.orderedQty ??
      row?.orderQty ??
      row?.quantity ??
      0
    );
    const receivedUnits = this.toInt(row?.quantityReceived ?? row?.receivedQty ?? row?.receivedQuantity ?? 0);

    return {
      purchaseItemId: this.toNullableNumber(row?.purchaseItemId ?? row?.id ?? row?.itemId ?? row?.lineItemId),
      productName: String(row?.productName ?? row?.medicineName ?? row?.medicine?.name ?? row?.itemName ?? `Item ${index + 1}`),
      sku: String(row?.sku ?? row?.skuCode ?? row?.medicine?.sku ?? ''),
      orderedUnits,
      batchNo: String(row?.batchNo ?? row?.batchNumber ?? '').trim(),
      expiryDate: this.toInputDate(row?.expiryDate ?? row?.expiryOn ?? row?.expiry ?? ''),
      purchasePrice: this.toNumber(row?.costPerUnit ?? row?.purchasePrice ?? row?.unitCost ?? row?.price ?? 0),
      sellPrice: this.toNumber(row?.sellPrice ?? row?.sellingPrice ?? row?.retailPrice ?? row?.mrp ?? 0),
      receivedUnits,
      deliveryStatus: this.normalizeReceiptDeliveryStatus(
        row?.deliveryStatus ?? row?.receiptStatus ?? row?.status,
        orderedUnits,
        receivedUnits
      )
    };
  }

  private buildPurchaseReceiptPayload(): PurchaseReceiptCreatePayload {
    return {
      purchaseId: this.purchaseId as number,
      receiptDate: this.currentLocalDateTime(),
      invoiceNumber: this.invoiceNumber.trim(),
      invoiceDate: this.invoiceDate,
      invoiceImageBase64: this.selectedInvoiceBase64,
      notes: this.remarks.trim(),
      isActive: true,
      items: this.lineItems.map((item) => ({
        purchaseItemId: item.purchaseItemId as number,
        quantityReceived: this.toInt(item.receivedUnits),
        batchNumber: String(item.batchNo ?? '').trim(),
        expirationDate: this.toInputDate(item.expiryDate),
        unitPrice: this.toNumber(item.purchasePrice),
        sellingPrice: this.toNumber(item.sellPrice),
        deliveryStatus: this.normalizeReceiptDeliveryStatus(item.deliveryStatus, item.orderedUnits, item.receivedUnits),
        isActive: true
      }))
    };
  }

  private extractApiSuccessMessage(res: any): string {
    return String(
      res?.message ??
      res?.statusMessage ??
      res?.data?.message ??
      ''
    ).trim();
  }

  private extractApiErrorMessage(err: any): string {
    const raw =
      err?.error?.message ??
      err?.error?.statusMessage ??
      err?.error?.error ??
      err?.message ??
      '';

    if (typeof raw === 'string') {
      return raw.trim();
    }

    return '';
  }

  private toDisplayDate(value: unknown): string {
    if (!value) {
      return '';
    }

    const asDate = new Date(String(value));
    if (Number.isNaN(asDate.getTime())) {
      return '';
    }

    return asDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private toInputDate(value: unknown): string {
    if (!value) {
      return '';
    }

    const raw = String(value).trim();
    if (!raw) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }

    const ddmmyyyy = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toInt(value: unknown): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }

    const raw = String(value ?? '').trim();
    const numericPrefix = raw.match(/^-?\d+(?:\.\d+)?/);
    if (!numericPrefix) {
      return 0;
    }

    const parsedFromText = Number(numericPrefix[0]);
    if (!Number.isFinite(parsedFromText)) {
      return 0;
    }

    return Math.max(0, Math.floor(parsedFromText));
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.round(parsed * 100) / 100;
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeReceiptDeliveryStatus(
    value: unknown,
    orderedUnits: number,
    receivedUnits: number
  ): ReceiptDeliveryStatus {
    const raw = String(value ?? '').trim();
    if (raw) {
      const normalized = raw.toUpperCase().replace(/[-\s]+/g, '_') as ReceiptDeliveryStatus;
      if (this.deliveryStatusOptions.includes(normalized)) {
        return normalized;
      }
    }

    if (orderedUnits > 0 && receivedUnits > 0 && receivedUnits < orderedUnits) {
      return 'PARTIALLY_RECEIVED';
    }

    return 'RECEIVED';
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result ?? '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;

        if (!base64) {
          reject(new Error('Empty file content'));
          return;
        }

        resolve(base64);
      };

      reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  private currentLocalDateTime(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');

    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  }

  private toDeliveryStatus(value: unknown): DeliveryStatus {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');

    if (raw.includes('deliver')) {
      return 'delivered';
    }

    if (raw.includes('delay') || raw.includes('hold')) {
      return 'delayed';
    }

    if (raw.includes('pending')) {
      return 'pending';
    }

    return 'in_transit';
  }
}
