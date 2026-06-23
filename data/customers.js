// data/customers.js
//
// Mock CRM. 15 customers, each with one order, deliberately covering every
// branch of the refund policy in data/refundPolicy.js:
//   - standard approve
//   - past-window deny
//   - non-refundable category deny (digital / gift card / grocery)
//   - opened-hygiene-item deny
//   - already-refunded (duplicate request) deny
//   - defective item inside extended window -> approve
//   - not-yet-delivered deny
//
// Dates are generated relative to "now" (daysAgo helper) so the demo keeps
// working correctly no matter when you record the walkthrough video.

function daysAgo(n) {
  if (n === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const customers = [
  {
    id: "CUST001",
    name: "Aditi Rao",
    email: "aditi.rao@example.com",
    tier: "Standard",
    memberSince: "2022-03-14",
    orders: [
      {
        orderId: "ORD1001",
        product: "SoundWave Pro Wireless Headphones",
        category: "electronics",
        price: 4999,
        currency: "INR",
        orderDate: daysAgo(12),
        deliveryDate: daysAgo(10),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST002",
    name: "Rohan Mehta",
    email: "rohan.mehta@example.com",
    tier: "Standard",
    memberSince: "2021-11-02",
    orders: [
      {
        orderId: "ORD1002",
        product: "BoomBox Mini Bluetooth Speaker",
        category: "electronics",
        price: 2499,
        currency: "INR",
        orderDate: daysAgo(45),
        deliveryDate: daysAgo(40),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST003",
    name: "Sneha Iyer",
    email: "sneha.iyer@example.com",
    tier: "VIP",
    memberSince: "2020-06-21",
    orders: [
      {
        orderId: "ORD1003",
        product: "EcoFlex Premium Yoga Mat",
        category: "home",
        price: 1299,
        currency: "INR",
        orderDate: daysAgo(7),
        deliveryDate: daysAgo(5),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST004",
    name: "Karthik Subramaniam",
    email: "karthik.s@example.com",
    tier: "Standard",
    memberSince: "2023-01-09",
    orders: [
      {
        orderId: "ORD1004",
        product: "Atomic Focus (eBook)",
        category: "digital",
        price: 399,
        currency: "INR",
        orderDate: daysAgo(3),
        deliveryDate: daysAgo(3),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST005",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    tier: "Standard",
    memberSince: "2022-08-30",
    orders: [
      {
        orderId: "ORD1005",
        product: "GlowTint Matte Lipstick Set",
        category: "beauty",
        price: 899,
        currency: "INR",
        orderDate: daysAgo(5),
        deliveryDate: daysAgo(3),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST006",
    name: "Arjun Krishnan",
    email: "arjun.krishnan@example.com",
    tier: "Standard",
    memberSince: "2021-05-17",
    orders: [
      {
        orderId: "ORD1006",
        product: "TrailRunner X2 Running Shoes",
        category: "clothing",
        price: 3499,
        currency: "INR",
        orderDate: daysAgo(22),
        deliveryDate: daysAgo(20),
        status: "Delivered",
        opened: false,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST007",
    name: "Divya Menon",
    email: "divya.menon@example.com",
    tier: "Standard",
    memberSince: "2023-04-11",
    orders: [
      {
        orderId: "ORD1007",
        product: "ArmorGrip Phone Case",
        category: "accessories",
        price: 599,
        currency: "INR",
        orderDate: daysAgo(14),
        deliveryDate: daysAgo(12),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST008",
    name: "Vikram Pillai",
    email: "vikram.pillai@example.com",
    tier: "VIP",
    memberSince: "2020-02-28",
    orders: [
      {
        orderId: "ORD1008",
        product: "DeskRise Laptop Stand",
        category: "electronics",
        price: 1799,
        currency: "INR",
        orderDate: daysAgo(7),
        deliveryDate: daysAgo(5),
        status: "Delivered",
        opened: true,
        refunded: true,
        refundedAt: daysAgo(2),
      },
    ],
  },
  {
    id: "CUST009",
    name: "Lakshmi Venkatesan",
    email: "lakshmi.v@example.com",
    tier: "Standard",
    memberSince: "2022-12-05",
    orders: [
      {
        orderId: "ORD1009",
        product: "Organic Roasted Almonds, 1kg",
        category: "grocery",
        price: 749,
        currency: "INR",
        orderDate: daysAgo(4),
        deliveryDate: daysAgo(2),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST010",
    name: "Sanjay Gupta",
    email: "sanjay.gupta@example.com",
    tier: "Standard",
    memberSince: "2021-09-19",
    orders: [
      {
        orderId: "ORD1010",
        product: "₹3000 E-Gift Card",
        category: "giftcard",
        price: 3000,
        currency: "INR",
        orderDate: daysAgo(6),
        deliveryDate: daysAgo(6),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST011",
    name: "Ananya Desai",
    email: "ananya.desai@example.com",
    tier: "Standard",
    memberSince: "2023-02-14",
    orders: [
      {
        orderId: "ORD1011",
        product: "ClassicFit Denim Jacket",
        category: "clothing",
        price: 2299,
        currency: "INR",
        orderDate: daysAgo(10),
        deliveryDate: daysAgo(8),
        status: "Delivered",
        opened: false,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST012",
    name: "Rahul Verma",
    email: "rahul.verma@example.com",
    tier: "Standard",
    memberSince: "2020-10-23",
    orders: [
      {
        orderId: "ORD1012",
        product: "ProClick Wireless Gaming Mouse",
        category: "electronics",
        price: 1899,
        currency: "INR",
        orderDate: daysAgo(55),
        deliveryDate: daysAgo(50),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST013",
    name: "Meera Krishnan",
    email: "meera.krishnan@example.com",
    tier: "VIP",
    memberSince: "2019-07-08",
    orders: [
      {
        orderId: "ORD1013",
        product: "ErgoSit Mesh Office Chair",
        category: "home",
        price: 8999,
        currency: "INR",
        orderDate: daysAgo(27),
        deliveryDate: daysAgo(25),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST014",
    name: "Siddharth Rao",
    email: "siddharth.rao@example.com",
    tier: "Standard",
    memberSince: "2022-05-30",
    orders: [
      {
        orderId: "ORD1014",
        product: "AirBuds Lite Wireless Earbuds",
        category: "electronics",
        price: 2199,
        currency: "INR",
        orderDate: daysAgo(20),
        deliveryDate: daysAgo(18),
        status: "Delivered",
        opened: true,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
  {
    id: "CUST015",
    name: "Kavya Reddy",
    email: "kavya.reddy@example.com",
    tier: "Standard",
    memberSince: "2023-06-02",
    orders: [
      {
        orderId: "ORD1015",
        product: "UrbanTrek 30L Backpack",
        category: "accessories",
        price: 2799,
        currency: "INR",
        orderDate: daysAgo(2),
        deliveryDate: null,
        status: "Processing",
        opened: false,
        refunded: false,
        refundedAt: null,
      },
    ],
  },
];

export function findCustomerByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return customers.find((c) => c.email.toLowerCase() === normalized) || null;
}

export function findOrderById(orderId) {
  if (!orderId) return null;
  const normalized = orderId.trim().toUpperCase();
  for (const customer of customers) {
    const order = customer.orders.find(
      (o) => o.orderId.toUpperCase() === normalized
    );
    if (order) return { order, customer };
  }
  return null;
}
