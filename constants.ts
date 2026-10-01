
import { ParcelData } from './types';

export const APP_NAME = "YAQIIN CARGO";
export const CURRENCY = "USD";

export const SHIPPING_RATES = {
  CLOTHING: 4.5,
  ELECTRONICS: 8.0,
  FURNITURE: 3.5,
  COSMETICS: 6.0,
};

export const MOCK_TRACKING_DATA: Record<string, ParcelData> = {
  "YAQ-882190": {
    id: "YAQ-882190",
    sender: "Guangzhou Trading Co.",
    receiver: "Azizbek T.",
    weight: "12.5 kg",
    history: [
      { date: "Oct 24", time: "14:30", status: "Delivered to Customer", location: "Tashkent, UZ", completed: true },
      { date: "Oct 24", time: "09:15", status: "Out for Delivery", location: "Tashkent, UZ", completed: true },
      { date: "Oct 22", time: "18:00", status: "Arrived at Destination Hub", location: "Tashkent, UZ", completed: true },
      { date: "Oct 18", time: "10:00", status: "Customs Clearance", location: "Tashkent Airport", completed: true },
      { date: "Oct 15", time: "22:45", status: "Departed Origin Country", location: "Guangzhou, CN", completed: true },
      { date: "Oct 14", time: "16:20", status: "Picked up by Carrier", location: "Guangzhou, CN", completed: true },
    ]
  },
  "YAQ-112233": {
    id: "YAQ-112233",
    sender: "Shenzhen Electronics Ltd.",
    receiver: "Malika Shop",
    weight: "45.0 kg",
    history: [
      { date: "Nov 02", time: "08:00", status: "Arrived at Warehouse", location: "Guangzhou, CN", completed: true },
      { date: "Nov 01", time: "14:00", status: "Order Processed", location: "Shenzhen, CN", completed: true },
    ]
  }
};

export const FAQ_SUGGESTIONS = [
  "How much for 10kg clothes?",
  "Where is your warehouse?",
  "Do you ship batteries?",
  "How long is shipping?"
];
