import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  taxId?: number;
  taxName?: string;
  inventories?: InventoryCreateDTO[];
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
}
