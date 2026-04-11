import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

interface BillHeader {
  billNo: string;
  billDate: string;
  customerName: string;
}

export interface ReturnItem {
  medicineName: string;
  category: string;
  form: string;
  batchNumber: string;
  soldQty: number;
  returnQty: number;
  unitPrice: number;
  billItemId?: number;
  medicineId?: number;
  inventoryId?: number;
}

@Component({
  selector: 'app-process-return',
  templateUrl: './process-return.component.html',
  styleUrls: ['./process-return.component.scss']
})
export class ProcessReturnComponent implements OnInit, OnDestroy {
  saleId = '';
  bill: BillHeader | null = null;
  items: ReturnItem[] = [];
  remarks = '';

  loading = false;
  submitting = false;
  errorMessage = '';
  submitError = '';
  submitSuccess = false;

  remarksInvalid = false;

  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.saleId = id && id.trim() ? id.trim() : '';
      if (this.saleId) {
        this.loadSaleDetails();
      } else {
        this.errorMessage = 'No bill selected. Please go back to Billing History.';
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get itemsReturningCount(): number {
    return this.items.filter(i => Number(i.returnQty) > 0).length;
  }

  get totalReturnQty(): number {
    return this.items.reduce((sum, i) => sum + (Number(i.returnQty) || 0), 0);
  }

  get totalRefundAmount(): number {
    return this.items.reduce(
      (sum, i) => sum + (Number(i.returnQty) || 0) * (Number(i.unitPrice) || 0),
      0
    );
  }

  get hasQuantityErrors(): boolean {
    return this.items.some(i => Number(i.returnQty) > i.soldQty);
  }

  cancel(): void {
    this.router.navigate(['/billing-history']);
  }

  submit(): void {
    this.remarksInvalid = !this.remarks.trim();

    if (this.remarksInvalid || this.hasQuantityErrors) {
      return;
    }

    const returnableItems = this.items.filter(i => Number(i.returnQty) > 0);
    if (!returnableItems.length) {
      this.submitError = 'Please enter a return quantity for at least one item.';
      return;
    }

    const missingRequiredData = returnableItems.some(i => {
      const billItemId = this.toNumber(i.billItemId);
      return !billItemId;
    });
    if (missingRequiredData) {
      this.submitError = 'Unable to submit: bill item ID is missing for one or more selected items.';
      return;
    }

    this.submitting = true;
    this.submitError = '';

    const originalBillNo = this.bill
      ? (isNaN(Number(this.bill.billNo)) ? this.bill.billNo : Number(this.bill.billNo))
      : this.saleId;

    const payload = {
      originalBillNo,
      returnReason: this.remarks.trim(),
      items: returnableItems.map(i => ({
        billItemId: this.toNumber(i.billItemId),
        quantityReturned: Number(i.returnQty),
        status: 'RESTOCKED',
        remarks: this.remarks.trim(),
        inventoryId: i.inventoryId ?? null,
        batchNumber: String(i.batchNumber ?? '').trim()
      }))
    };

    this.http.post(API_ENDPOINTS.RETURNS.CREATE, payload)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.submitting = false;
        if (!res) {
          this.submitError = 'Submission failed. Please try again.';
          return;
        }
        this.submitSuccess = true;
        setTimeout(() => this.router.navigate(['/billing-history']), 1800);
      });
  }

  private loadSaleDetails(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<any>(API_ENDPOINTS.SALES.DETAILS(this.saleId))
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.loading = false;

        if (!res) {
          this.errorMessage = 'Failed to load bill details. Please try again.';
          return;
        }

        this.bill = {
          billNo: res.billNo ?? res.saleId ?? res.id ?? this.saleId,
          billDate: res.billDate ?? res.createdAt ?? '',
          customerName: res.customerName ?? res.patientName ?? ''
        };

        // items array has quantities/prices; orderContext has medicineName, dose, batchNumber.
        // Merge them by medicineId so both fields are available.
        const rawItems: any[] = Array.isArray(res.items) ? res.items
          : Array.isArray(res.saleItems) ? res.saleItems : [];

        const contextMap: Record<number, any> = {};
        if (Array.isArray(res.orderContext)) {
          res.orderContext.forEach((c: any) => {
            if (c.medicineId != null) {
              contextMap[c.medicineId] = c;
            }
          });
        }

        // Merge rawItem into contextMap entry, but do NOT let null/undefined from rawItem
        // override a valid value already present in contextMap (e.g. batchNumber, unitPrice).
        const safeMerge = (ctx: any, raw: any): any => {
          const merged: any = { ...ctx };
          for (const [k, v] of Object.entries(raw)) {
            if (v !== undefined && v !== null) {
              merged[k] = v;
            } else if (!(k in merged)) {
              merged[k] = v;
            }
          }
          return merged;
        };

        const orderContext: any[] = Array.isArray(res.orderContext) ? res.orderContext : [];

        // If raw items are empty but orderContext is present, use it directly.
        // Keep both raw and merged objects so IDs (like billItemId) can always be sourced from raw items.
        const lines: Array<{ raw: any; merged: any }> = rawItems.length
          ? rawItems.map((raw, index) => {
              const key = raw?.medicineId ?? raw?.medicine?.id ?? raw?.productId;
              const fromContext = key != null ? contextMap[key] : undefined;
              return {
                raw,
                merged: safeMerge(fromContext ?? orderContext[index] ?? {}, raw)
              };
            })
          : orderContext.map(ctx => ({ raw: null, merged: ctx }));

        this.items = lines.map(({ raw, merged }) => {
          const soldQty = this.toNumber(merged.quantity ?? merged.soldQty ?? merged.qty);
          const billItemId = this.getBillItemId(raw) ?? this.getBillItemId(merged);
          const batchNumber = this.getBatchNumber(raw) || this.getBatchNumber(merged);
          return {
            medicineName: merged.medicineName ?? merged.name ?? merged.itemName ?? '',
            category: merged.category ?? merged.productType ?? merged.genericName ?? merged.dose ?? '',
            form: merged.form ?? merged.dosageForm ?? '',
            batchNumber,
            soldQty,
            returnQty: 0,
            unitPrice: this.getUnitPrice(merged, soldQty),
            billItemId,
            medicineId: this.toNumber(merged.medicineId ?? merged.medicine?.id) || undefined,
            inventoryId: this.toNumber(merged.inventoryId ?? merged.inventory?.id) || undefined
          };
        });
      });
  }

  private toNumber(value: any): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[^0-9.-]/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private getUnitPrice(line: any, soldQty: number): number {
    const direct = this.toNumber(
      line.unitPrice
      ?? line.price
      ?? line.sellingPrice
      ?? line.salePrice
      ?? line.rate
      ?? line.mrp
      ?? line.amount
      ?? line.itemPrice
      ?? line.unit_rate
      ?? line.unitRate
      ?? line.inventory?.unitPrice
      ?? line.inventory?.sellingPrice
      ?? line.medicine?.unitPrice
      ?? line.medicine?.sellingPrice
    );

    if (direct > 0) {
      return direct;
    }

    const totalAmount = this.toNumber(line.lineAmount ?? line.totalAmount ?? line.amountPaid ?? line.total);
    if (totalAmount > 0 && soldQty > 0) {
      return totalAmount / soldQty;
    }

    return 0;
  }

  private getBillItemId(line: any): number | undefined {
    const id = this.toNumber(
      line.billItemId
      ?? line.saleItemId
      ?? line.saleLineId
      ?? line.itemId
      ?? line.lineId
      ?? line.id
      ?? line.billItem?.id
      ?? line.saleItem?.id
    );
    return id || undefined;
  }

  private getBatchNumber(line: any): string {
    const batch = line.batchNumber
      ?? line.batchNo
      ?? line.batch
      ?? line.batchNum
      ?? line.inventoryBatch
      ?? line.inventory?.batchNumber
      ?? line.inventory?.batchNo
      ?? line.stock?.batchNumber
      ?? '';
    return String(batch).trim();
  }
}
