import { z } from 'zod';

export const TrackingNumberSchema = z.string()
  .trim()
  .min(4, 'Trek raqami juda qisqa (kamida 4 ta belgi)')
  .max(64, 'Trek raqami juda uzun (ko\'pi bilan 64 ta belgi)')
  .regex(/^[A-Za-z0-9\-_]+$/, 'Trek raqamida faqat lotin harflari va raqamlar bo\'lishi kerak');

export const AddParcelsPayloadSchema = z.object({
  trackingNumbers: z.array(TrackingNumberSchema).min(1, 'Kamida bitta trek raqami kiriting').max(30, 'Bitta so\'rovda ko\'pi bilan 30 ta trek kiritish mumkin')
});

export const LocationRequestSchema = z.object({
  requestedBranchId: z.string().uuid('Filial ID formati noto\'g\'ri')
});

export const BulkStatusUpdateSchema = z.object({
  parcelIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['added', 'china_warehouse', 'in_transit', 'uzbekistan', 'delivered'])
});

export const BulkPaymentUpdateSchema = z.object({
  parcelIds: z.array(z.string().uuid()).min(1),
  paymentStatus: z.enum(['pending', 'paid'])
});

export const MarkSubmittedSchema = z.object({
  parcelIds: z.array(z.string().uuid()).min(1)
});

export const CargoProviderUpdateSchema = z.object({
  internalName: z.string().min(1),
  receiverName: z.string().min(1),
  phone: z.string().min(5),
  province: z.string().min(1),
  city: z.string().min(1),
  district: z.string().optional(),
  fullAddress: z.string().min(1),
  warehouseCode: z.string().min(1),
  addressTemplate: z.string().min(1),
  active: z.boolean()
});

export const SettingsUpdateSchema = z.object({
  pricePerKg: z.number().positive(),
  exchangeRate: z.number().positive(),
  supportUsername: z.string().min(1),
  ofertaText: z.string().optional(),
  ofertaTitle: z.string().optional(),
});
