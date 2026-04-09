import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MedicineService, MedicineListItem, MedicineCardsDTO } from '../../services/medicine.service';

@Component({
  selector: 'app-medicine-catalog',
  templateUrl: './medicine-catalog.component.html',
  styleUrls: ['./medicine-catalog.component.scss']
})
export class MedicineCatalogComponent implements OnInit {
  totalSku = 0;
  lowStockCount = 0;
  outOfStock = 0;
  catalogValue = 0;

  medicines: MedicineListItem[] = [];

  // paging
  page = 0;
  // configurable rows-per-page at component level (default 5)
  rowsPerPage = 5;
  totalElements = 0;
  totalPages = 0;
  loading = false;
  cardsLoading = false;

  // filters
  q = '';
  category = '';
  status = '';
  sort = 'name';
  dir: 'asc' | 'desc' = 'asc';

  constructor(private svc: MedicineService, private router: Router) {}

  ngOnInit(): void {
    this.loadPage(0);
    this.loadCards();
  }

  private loadCards() {
    this.cardsLoading = true;
    this.svc.getCards().subscribe((c: MedicineCardsDTO) => {
      this.totalSku = c.totalSku ?? 0;
      this.lowStockCount = c.lowStockCount ?? 0;
      this.outOfStock = c.outOfStockCount ?? 0;
      this.catalogValue = c.catalogValue ?? 0;
      this.cardsLoading = false;
    }, _err => {
      this.cardsLoading = false;
    });
  }

  private loadPage(p: number) {
    this.loading = true;
    this.svc.getMedicines({ page: p, size: this.rowsPerPage, sort: this.sort, dir: this.dir, q: this.q, category: this.category, status: this.status })
      .subscribe(res => {
        const items = (res.items && res.items.length) ? res.items : (res.content || []);
        this.medicines = items as MedicineListItem[];
        this.page = res.page ?? p;
        this.rowsPerPage = res.size ?? this.rowsPerPage;
        this.totalElements = res.totalElements ?? 0;
        this.totalPages = res.totalPages ?? Math.ceil(this.totalElements / this.rowsPerPage);
        this.loading = false;
      }, _err => { this.loading = false; });
  }

  goToPage(p: number) { if (p >= 0 && p < this.totalPages) this.loadPage(p); }
  prevPage() { if (this.page > 0) this.loadPage(this.page - 1); }
  nextPage() { if (this.page < this.totalPages - 1) this.loadPage(this.page + 1); }

  openEdit(m: MedicineListItem) {
    const id = (m as any).medicineId ?? m.id;
    if (!id) return;
    this.router.navigate(['/inventory/edit-product', id]);
  }

  get visiblePageNumbers(): number[] {
    const max = 5;
    const pages: number[] = [];
    const start = Math.max(0, this.page - Math.floor(max / 2));
    let end = Math.min(this.totalPages, start + max);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
  }

  get startItem(): number {
    return this.totalElements === 0 ? 0 : this.page * this.rowsPerPage + 1;
  }

  get endItem(): number {
    return Math.min((this.page + 1) * this.rowsPerPage, this.totalElements);
  }
}
