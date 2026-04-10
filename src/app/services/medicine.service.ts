import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '../config/api-endpoints';

export interface MedicineListItem {
  id?: number;
  name: string;
  form?: string;
  genericName?: string;
  productType?: string;
  price?: number;
  status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  sku?: string;
}

export interface PagedMedicines {
  items?: MedicineListItem[]; // some backends return `items`
  content?: MedicineListItem[]; // Spring returns `content`
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface MedicineCardsDTO {
  totalSku: number;
  lowStockCount: number;
  outOfStockCount: number;
  catalogValue: number; // backend sends numeric value (e.g. BigDecimal) - received as number
}

export interface InventoryCreateDTO {
  inventoryId?: number;
  id?: number;
  batchNumber?: string;
  location?: string;
  expirationDate?: string;
  quantityOnHand?: number;
  purchasePrice?: number;
  sellingPrice?: number;

  // Backward-compatible aliases for older payload/response shapes.
  expiryDate?: string;
  quantity?: number;
}

export interface CreateMedicineRequest {
  medicineId?: number;
  name: string;
  productType?: string;
  genericName?: string;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
  reorderLevel?: number;
  isPrescriptionRequired?: boolean;
  description?: string;
  taxId: number;
  taxName?: string;
  inventories?: InventoryCreateDTO[];
}

export interface MedicineDetailsResponse {
  medicineId?: number;
  id?: number;
  name?: string;
  productType?: string;
  genericName?: string;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
  reorderLevel?: number;
  isPrescriptionRequired?: boolean;
  taxId?: number;
  taxName?: string;
  inventories?: InventoryCreateDTO[];
}

export interface SaleItemCreateRequest {
  medicineId: number;
  inventoryId: number | null;
  quantity: number;
}

export interface SaleCreateRequest {
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  items: SaleItemCreateRequest[];
  subtotalAmount?: number;
  discountAmount?: number;
  gstAmount?: number;
  grandTotalAmount?: number;
  paymentBreakdown?: {
    cash: number;
    card: number;
    upi: number;
  };
  orderContext?: Array<{
    medicineId: number;
    inventoryId: number | null;
    medicineName: string;
    dose: string;
    unitPrice: number;
    isTaxInclusivePrice?: boolean;
    gstRate: number;
    gstAmount: number;
    quantity: number;
    lineTaxableAmount?: number;
    lineGrossAmount?: number;
    lineAmount: number;
  }>;
}

interface AlphaMedicinesResponse {
  content?: MedicineDetailsResponse[];
  items?: MedicineDetailsResponse[];
  data?: MedicineDetailsResponse[];
}

@Injectable({ providedIn: 'root' })
export class MedicineService {
  private base = API_ENDPOINTS.MEDICINES.LIST;
  private cardsUrl = API_ENDPOINTS.MEDICINES.CARDS;
  constructor(private http: HttpClient) {}

  getMedicines(options: {
    page?: number;
    size?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
    q?: string;
    category?: string;
    status?: string;
  }): Observable<PagedMedicines> {
    let params = new HttpParams();
    if (options.page != null) params = params.set('page', String(options.page));
    if (options.size != null) params = params.set('size', String(options.size));
    if (options.sort) params = params.set('sort', options.sort);
    if (options.dir) params = params.set('dir', options.dir);
    if (options.q) params = params.set('q', options.q);
    if (options.category) params = params.set('category', options.category);
    if (options.status) params = params.set('status', options.status);

    return this.http.get<PagedMedicines>(this.base, { params });
  }

  getCards(): Observable<MedicineCardsDTO> {
    return this.http.get<MedicineCardsDTO>(this.cardsUrl);
  }

  createMedicine(payload: CreateMedicineRequest): Observable<any> {
    return this.http.post<any>(this.base, payload);
  }

  getMedicineById(id: number): Observable<MedicineDetailsResponse> {
    return this.http.get<MedicineDetailsResponse>(API_ENDPOINTS.MEDICINES.DETAILS(id));
  }

  updateMedicine(id: number, payload: CreateMedicineRequest): Observable<any> {
    return this.http.put<any>(API_ENDPOINTS.MEDICINES.DETAILS(id), payload);
  }

  createSale(payload: SaleCreateRequest): Observable<any> {
    const body = this.sanitizeSalePayload(payload);
    return this.http.post<any>(API_ENDPOINTS.SALES.CREATE, body);
  }

  /**
   * Sanitize the sale payload to include only plain primitive values.
   * This ensures no DOM/element prototypes or extra methods are accidentally serialized.
   */
  private sanitizeSalePayload(payload: SaleCreateRequest): SaleCreateRequest {
    const mapItem = (it: SaleItemCreateRequest): SaleItemCreateRequest => ({
      medicineId: Number(it.medicineId),
      inventoryId: it.inventoryId == null ? null : Number(it.inventoryId),
      quantity: Number(it.quantity)
    });

    const body: SaleCreateRequest = {
      customerName: String(payload.customerName || '').trim() || 'Walk-in Customer',
      paymentMethod: String(payload.paymentMethod || 'CASH'),
      items: Array.isArray(payload.items) ? payload.items.map(mapItem) : []
    };

    if (payload.customerPhone) {
      const phone = String(payload.customerPhone).trim();
      if (phone) {
        body.customerPhone = phone;
      }
    }

    if (payload.subtotalAmount != null) body.subtotalAmount = Number(payload.subtotalAmount);
    if (payload.discountAmount != null) body.discountAmount = Number(payload.discountAmount);
    if (payload.gstAmount != null) body.gstAmount = Number(payload.gstAmount);
    if (payload.grandTotalAmount != null) body.grandTotalAmount = Number(payload.grandTotalAmount);

    if (payload.paymentBreakdown) {
      body.paymentBreakdown = {
        cash: Number(payload.paymentBreakdown.cash || 0),
        card: Number(payload.paymentBreakdown.card || 0),
        upi: Number(payload.paymentBreakdown.upi || 0)
      };
    }

    if (Array.isArray(payload.orderContext)) {
      body.orderContext = payload.orderContext.map((line) => ({
        medicineId: Number(line.medicineId),
        inventoryId: line.inventoryId == null ? null : Number(line.inventoryId),
        medicineName: String(line.medicineName || ''),
        dose: String(line.dose || ''),
        unitPrice: Number(line.unitPrice || 0),
        isTaxInclusivePrice: !!line.isTaxInclusivePrice,
        gstRate: Number(line.gstRate || 0),
        gstAmount: Number(line.gstAmount || 0),
        quantity: Number(line.quantity || 0),
        lineTaxableAmount: Number(line.lineTaxableAmount || 0),
        lineGrossAmount: Number(line.lineGrossAmount || 0),
        lineAmount: Number(line.lineAmount || 0)
      }));
    }

    return body;
  }

  getMedicinesAlpha(startsWith?: string): Observable<MedicineDetailsResponse[]> {
    let params = new HttpParams();
    const prefix = startsWith?.trim();

    if (prefix) {
      params = params.set('startsWith', prefix);
    }

    return this.http
      .get<MedicineDetailsResponse[] | AlphaMedicinesResponse>(API_ENDPOINTS.MEDICINES.ALPHA, { params })
      .pipe(
        map((res) => {
          if (Array.isArray(res)) {
            return res;
          }
          return res.content || res.items || res.data || [];
        })
      );
  }
}
