import { Component } from '@angular/core';

interface MedicineCard {
  id: number;
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

@Component({
  selector: 'app-medicines-billing',
  templateUrl: './medicines-billing.component.html',
  styleUrls: ['./medicines-billing.component.scss']
})
export class MedicinesBillingComponent {
  readonly vatRate = 0.05;
  readonly discountRate = 0.05;
  readonly maxVisibleCards = 16;

  searchTerm = '';
  customDiscount = 0;

  customerName = 'Walk-in Customer';
  sessionLabel = 'Guest Checkout #8910';

  payment = {
    cash: 0,
    card: 0,
    upi: 0
  };

  medicines: MedicineCard[] = [
    {
      id: 1,
      name: 'Paracetamol',
      dose: '500mg',
      packInfo: '60 Caps',
      brand: 'Crocin',
      categoryTag: 'OTC',
      complianceTag: 'Batch: #9021',
      stock: 142,
      price: 12.5,
      prescriptionOnly: false,
      style: 'default',
      icon: 'medication'
    },
    {
      id: 2,
      name: 'Amoxicillin',
      dose: '250mg',
      packInfo: '20 Tablets',
      brand: 'Mox',
      categoryTag: 'REQ. RX',
      complianceTag: 'Antibiotic',
      stock: 12,
      price: 45,
      prescriptionOnly: true,
      style: 'alert',
      icon: 'vaccines'
    },
    {
      id: 3,
      name: 'Metformin',
      dose: '500mg',
      packInfo: '100 Tabs',
      brand: 'Glucophage',
      categoryTag: 'Diabetes',
      complianceTag: 'Batch: #8872',
      stock: 89,
      price: 32.2,
      prescriptionOnly: false,
      style: 'default',
      icon: 'health_and_safety'
    },
    {
      id: 4,
      name: 'Ventolin Inhaler',
      dose: '100mcg',
      packInfo: '1 Unit',
      brand: 'GSK',
      categoryTag: 'Respiratory',
      complianceTag: 'Out of stock',
      stock: 0,
      price: 18.9,
      prescriptionOnly: false,
      style: 'danger',
      icon: 'air'
    }
  ];

  orderItems: OrderItem[] = [
    this.withQuantity(this.medicines[0], 2),
    this.withQuantity(this.medicines[1], 1)
  ];

  get filteredMedicines(): MedicineCard[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.medicines;
    }

    return this.medicines.filter((medicine) => {
      return (
        medicine.name.toLowerCase().includes(term)
        || medicine.brand.toLowerCase().includes(term)
        || medicine.categoryTag.toLowerCase().includes(term)
      );
    });
  }

  get visibleMedicines(): MedicineCard[] {
    return this.filteredMedicines.slice(0, this.maxVisibleCards);
  }

  get subtotal(): number {
    return this.round2(this.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0));
  }

  get taxAmount(): number {
    return this.round2(this.subtotal * this.vatRate);
  }

  get bulkDiscount(): number {
    const defaultDiscount = this.subtotal * this.discountRate;
    const discount = this.customDiscount > 0 ? this.customDiscount : defaultDiscount;
    return this.round2(Math.min(Math.max(discount, 0), this.subtotal));
  }

  get grandTotal(): number {
    return this.round2(this.subtotal + this.taxAmount - this.bulkDiscount);
  }

  get canCompleteSale(): boolean {
    return this.orderItems.length > 0;
  }

  clearOrder(): void {
    this.orderItems = [];
    this.payment = { cash: 0, card: 0, upi: 0 };
    this.customDiscount = 0;
  }

  addToOrder(medicine: MedicineCard): void {
    if (medicine.stock <= 0) {
      return;
    }

    const existing = this.orderItems.find((item) => item.id === medicine.id);
    if (existing) {
      this.increment(existing);
      return;
    }

    this.orderItems = [...this.orderItems, this.withQuantity(medicine, 1)];
  }

  increment(item: OrderItem): void {
    const source = this.medicines.find((medicine) => medicine.id === item.id);
    if (!source) {
      return;
    }

    if (item.quantity >= source.stock) {
      return;
    }

    item.quantity += 1;
  }

  decrement(item: OrderItem): void {
    if (item.quantity <= 1) {
      this.removeLine(item);
      return;
    }

    item.quantity -= 1;
  }

  removeLine(item: OrderItem): void {
    this.orderItems = this.orderItems.filter((line) => line.id !== item.id);
  }

  submitSale(): void {
    if (!this.canCompleteSale) {
      return;
    }

    this.clearOrder();
  }

  trackByMedicine(_: number, medicine: MedicineCard): number {
    return medicine.id;
  }

  trackByOrder(_: number, item: OrderItem): number {
    return item.id;
  }

  private withQuantity(medicine: MedicineCard, quantity: number): OrderItem {
    return {
      ...medicine,
      quantity
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
