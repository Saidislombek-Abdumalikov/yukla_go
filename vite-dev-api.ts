import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { processTelegramUpdate } from './api/_lib/botEngine';
import { ALL_BRANCHES, findBranchById } from './api/_lib/branchesData';

interface DevParcel {
  id: string;
  trackingNumber: string;
  customerCode: string;
  status: 'added' | 'china_warehouse' | 'in_transit' | 'uzbekistan' | 'delivered';
  paymentStatus: 'pending' | 'paid';
  weightKg: number;
  amount: number;
  currency: string;
  chinaDate?: string;
  estimatedArrival?: string;
  cargoSubmittedAt?: string | null;
  deliveryBranchSnapshot?: {
    provider: string;
    branchName: string;
    region: string;
    address: string;
  };
  createdAt: string;
}

// In-memory dev state
let devUser = {
  id: 'usr_dev_100',
  telegramUserId: 99887766,
  customerCode: 'YK-100',
  name: 'Saidislom',
  phone: '+998 90 123 45 67',
  phoneVerified: true,
  status: 'active',
  ofertaAccepted: true,
  defaultDeliveryBranch: {
    provider: 'EMU',
    branchName: 'EMU Chortoq',
    region: 'Namangan viloyati',
    address: 'Mustaqillik ko\'chasi 10',
  },
};

let devRates = {
  pricePerKg: 9.5,
  exchangeRate: 12850,
  supportUsername: 'nothing_related',
};

let devWarehouse = {
  id: 'cp_1',
  internal_name: 'Main China Air Hub',
  receiver_name: 'Yukla Go',
  phone: '13335957161',
  province: '浙江省',
  city: '金华市义乌市',
  warehouse_code: '077库房/70099号',
  address_template: '077库房/70099号 {customer_id}',
  active: true,
};

const devBranches = ALL_BRANCHES.map(b => ({
  id: b.id,
  provider: b.provider,
  branch_name: b.branchName,
  branchName: b.branchName,
  region: b.region,
  address: b.address,
  phone: b.phone,
}));

let devParcels: DevParcel[] = [
  {
    id: 'p_1',
    trackingNumber: 'YT882910291CN',
    customerCode: 'YK-100',
    status: 'in_transit',
    paymentStatus: 'pending',
    weightKg: 3.2,
    amount: 30.40,
    currency: 'USD',
    chinaDate: '28.09.2026',
    estimatedArrival: '05.10.2026',
    cargoSubmittedAt: '2026-09-28T12:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Chortoq',
      region: 'Namangan viloyati',
      address: 'Mustaqillik ko\'chasi 10',
    },
    createdAt: '2026-09-28T10:00:00.000Z',
  },
  {
    id: 'p_2',
    trackingNumber: 'SF992019482CN',
    customerCode: 'YK-100',
    status: 'china_warehouse',
    paymentStatus: 'pending',
    weightKg: 1.5,
    amount: 14.25,
    currency: 'USD',
    chinaDate: '01.10.2026',
    estimatedArrival: '08.10.2026',
    cargoSubmittedAt: null,
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Chortoq',
      region: 'Namangan viloyati',
      address: 'Mustaqillik ko\'chasi 10',
    },
    createdAt: '2026-10-01T08:30:00.000Z',
  },
  {
    id: 'p_3',
    trackingNumber: 'JT382910381CN',
    customerCode: 'YK-101',
    status: 'uzbekistan',
    paymentStatus: 'paid',
    weightKg: 4.8,
    amount: 45.60,
    currency: 'USD',
    chinaDate: '20.09.2026',
    estimatedArrival: '02.10.2026',
    cargoSubmittedAt: '2026-09-20T16:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Chilonzor',
      region: 'Toshkent shahri',
      address: 'Chilonzor 9-mavze, Qatortol 1',
    },
    createdAt: '2026-09-20T14:15:00.000Z',
  },
  {
    id: 'p_4',
    trackingNumber: 'YT771928371CN',
    customerCode: 'YK-102',
    status: 'delivered',
    paymentStatus: 'paid',
    weightKg: 2.1,
    amount: 19.95,
    currency: 'USD',
    chinaDate: '15.09.2026',
    estimatedArrival: '23.09.2026',
    cargoSubmittedAt: '2026-09-15T12:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Chorsu Markaz',
      region: 'Namangan viloyati',
      address: 'Namangan sh., Chorsu dahasi, 12-uy',
    },
    createdAt: '2026-09-15T10:00:00.000Z',
  },
  {
    id: 'p_5',
    trackingNumber: 'SF391820192CN',
    customerCode: 'YK-103',
    status: 'china_warehouse',
    paymentStatus: 'pending',
    weightKg: 5.4,
    amount: 51.30,
    currency: 'USD',
    chinaDate: '01.10.2026',
    estimatedArrival: '08.10.2026',
    cargoSubmittedAt: null,
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Samarqand Markaz',
      region: 'Samarqand viloyati',
      address: 'Mirzo Ulug\'bek ko\'chasi 45',
    },
    createdAt: '2026-10-01T11:00:00.000Z',
  },
  {
    id: 'p_6',
    trackingNumber: 'YT559281729CN',
    customerCode: 'YK-104',
    status: 'in_transit',
    paymentStatus: 'pending',
    weightKg: 1.8,
    amount: 17.10,
    currency: 'USD',
    chinaDate: '29.09.2026',
    estimatedArrival: '06.10.2026',
    cargoSubmittedAt: '2026-09-29T14:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Yunusobod',
      region: 'Toshkent shahri',
      address: 'Yunusobod 4-mavze, 15-uy',
    },
    createdAt: '2026-09-29T09:00:00.000Z',
  },
  {
    id: 'p_7',
    trackingNumber: 'JT920192841CN',
    customerCode: 'YK-105',
    status: 'china_warehouse',
    paymentStatus: 'pending',
    weightKg: 2.6,
    amount: 24.70,
    currency: 'USD',
    chinaDate: '02.10.2026',
    estimatedArrival: '09.10.2026',
    cargoSubmittedAt: null,
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Andijon Markaz',
      region: 'Andijon viloyati',
      address: 'Mashrab ko\'chasi 18',
    },
    createdAt: '2026-10-02T08:00:00.000Z',
  },
  {
    id: 'p_8',
    trackingNumber: 'YT661928301CN',
    customerCode: 'YK-106',
    status: 'uzbekistan',
    paymentStatus: 'pending',
    weightKg: 3.5,
    amount: 33.25,
    currency: 'USD',
    chinaDate: '25.09.2026',
    estimatedArrival: '03.10.2026',
    cargoSubmittedAt: '2026-09-25T10:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Qo\'qon',
      region: 'Farg\'ona viloyati',
      address: 'Turkiston ko\'chasi 54',
    },
    createdAt: '2026-09-25T07:30:00.000Z',
  },
];

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const [path, queryString] = rawUrl.split('?');

        if (!path.startsWith('/api/')) {
          return next();
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          return res.end();
        }

        const params = new URLSearchParams(queryString || '');

        // 1. Auth session
        if (path === '/api/auth/session') {
          return sendJson(res, 200, {
            token: 'dev-session-token-yk100',
            user: devUser,
          });
        }

        // 2. User profile
        if (path === '/api/user/me') {
          return sendJson(res, 200, devUser);
        }

        // 3. Warehouse address (Dynamic from devWarehouse)
        if (path === '/api/config/warehouse') {
          const region = `${devWarehouse.province} ${devWarehouse.city}`.trim();
          const address = devWarehouse.address_template
            .replace('{warehouse_code}', devWarehouse.warehouse_code)
            .replace('{customer_id}', devUser.customerCode);

          return sendJson(res, 200, {
            receiver: `${devWarehouse.receiver_name} (${devUser.customerCode})`,
            phone: devWarehouse.phone,
            region,
            address,
            customerCode: devUser.customerCode,
          });
        }

        // 4. Shipping rates (Dynamic from devRates)
        if (path === '/api/config/rates') {
          return sendJson(res, 200, {
            pricePerKg: devRates.pricePerKg,
            exchangeRate: devRates.exchangeRate,
          });
        }

        // 5. Branches
        if (path === '/api/branches') {
          const provider = params.get('provider');
          let result = devBranches;
          if (provider) {
            result = result.filter(b => b.provider.toUpperCase() === provider.toUpperCase());
          }
          return sendJson(res, 200, result);
        }

        // 6. User location request
        if (path === '/api/user/location-request' && req.method === 'POST') {
          const body = await readBody(req);
          const found = devBranches.find(b => b.id === body.requestedBranchId);
          if (found) {
            devUser.defaultDeliveryBranch = {
              provider: found.provider,
              branchName: found.branchName,
              region: found.region,
              address: found.address,
            };
          }
          return sendJson(res, 200, {
            success: true,
            message: 'Manzilni o\'zgartirish so\'rovi qabul qilindi',
          });
        }

        // 7. Parcels GET / POST (Customer App)
        if (path === '/api/parcels') {
          if (req.method === 'GET') {
            return sendJson(res, 200, devParcels);
          }

          if (req.method === 'POST') {
            const body = await readBody(req);
            let trackList: string[] = [];
            if (typeof body.trackingNumber === 'string') {
              trackList = [body.trackingNumber];
            } else if (Array.isArray(body.trackingNumbers)) {
              trackList = body.trackingNumbers;
            }

            const cleanTracks = trackList
              .map(t => t.trim().toUpperCase())
              .filter(t => t.length > 0);

            if (cleanTracks.length === 0) {
              return sendJson(res, 400, { error: 'Trek raqamini kiriting' });
            }

            for (const t of cleanTracks) {
              const newParcel: DevParcel = {
                id: `p_dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                trackingNumber: t,
                customerCode: devUser.customerCode,
                status: 'added',
                paymentStatus: 'pending',
                weightKg: 0,
                amount: 0,
                currency: 'USD',
                chinaDate: new Date().toLocaleDateString('ru-RU'),
                estimatedArrival: 'Aniqlanmoqda',
                cargoSubmittedAt: null,
                deliveryBranchSnapshot: devUser.defaultDeliveryBranch,
                createdAt: new Date().toISOString(),
              };
              devParcels.unshift(newParcel);
            }

            return sendJson(res, 201, {
              success: true,
              message: `${cleanTracks.length} ta trek muvaffaqiyatli qo'shildi`,
              parcels: devParcels,
            });
          }
        }

        // 8. Admin preview endpoints
        if (path.startsWith('/api/admin/')) {
          if (path === '/api/admin/stats') {
            const unsubmittedCount = devParcels.filter(p => !p.cargoSubmittedAt).length;
            return sendJson(res, 200, {
              totalUsers: 142,
              activeParcels: devParcels.filter(p => p.status !== 'delivered').length,
              unsubmittedTracks: unsubmittedCount,
              deliveredParcels: devParcels.filter(p => p.status === 'delivered').length,
              pendingLocationRequests: 2,
            });
          }

          if (path === '/api/admin/users') {
            return sendJson(res, 200, [devUser]);
          }

          if (path === '/api/admin/parcels') {
            if (req.method === 'GET') {
              let result = devParcels;
              const unsubmitted = params.get('unsubmitted');
              const search = params.get('search');
              const provider = params.get('provider');
              const region = params.get('region');
              const branchId = params.get('branchId');

              if (unsubmitted === 'true') {
                result = result.filter(p => !p.cargoSubmittedAt);
              }
              if (provider && provider !== 'ALL') {
                result = result.filter(p => p.deliveryBranchSnapshot?.provider?.toUpperCase() === provider.toUpperCase());
              }
              if (region && region !== 'ALL') {
                result = result.filter(p => p.deliveryBranchSnapshot?.region?.toLowerCase().includes(region.toLowerCase()));
              }
              if (branchId && branchId !== 'ALL') {
                result = result.filter(p => p.deliveryBranchSnapshot?.branchName?.toLowerCase().includes(branchId.toLowerCase()) || p.deliveryBranchSnapshot?.address?.toLowerCase().includes(branchId.toLowerCase()));
              }
              if (search) {
                const s = search.toLowerCase();
                result = result.filter(p => p.trackingNumber.toLowerCase().includes(s) || p.customerCode.toLowerCase().includes(s));
              }
              return sendJson(res, 200, result);
            }

            // PATCH: Bulk status, payment, mark_submitted, or update weight/amount
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              const { action, parcelIds, value, weightKg, amount } = body;
              if (Array.isArray(parcelIds)) {
                for (const id of parcelIds) {
                  const p = devParcels.find(item => item.id === id);
                  if (p) {
                    if (action === 'status') p.status = value;
                    if (action === 'payment') p.paymentStatus = value;
                    if (action === 'mark_submitted') p.cargoSubmittedAt = new Date().toISOString();
                    if (weightKg !== undefined) {
                      p.weightKg = Number(weightKg);
                      p.amount = Number((p.weightKg * devRates.pricePerKg).toFixed(2));
                    }
                    if (amount !== undefined) p.amount = Number(amount);
                  }
                }
              }
              return sendJson(res, 200, {
                success: true,
                message: 'Yuklar muvaffaqiyatli yangilandi',
                parcels: devParcels,
              });
            }

            // POST: Admin enters / imports tracks for users
            if (req.method === 'POST') {
              const body = await readBody(req);
              const { trackingNumbers, customerCode, status = 'china_warehouse', weightKg = 0, branchId, branch } = body;
              let tracks: string[] = [];
              if (typeof body.trackingNumber === 'string') tracks = [body.trackingNumber];
              else if (Array.isArray(trackingNumbers)) tracks = trackingNumbers;

              const cleanTracks = tracks
                .map(t => t.trim().toUpperCase())
                .filter(t => t.length > 0);

              const chosenBranch = branchId ? findBranchById(branchId) : (branch || null);
              const branchSnapshot = chosenBranch ? {
                provider: chosenBranch.provider,
                branchName: chosenBranch.branchName || chosenBranch.branch_name,
                region: chosenBranch.region,
                address: chosenBranch.address,
              } : devUser.defaultDeliveryBranch;

              let addedCount = 0;
              for (const trk of cleanTracks) {
                if (!devParcels.some(p => p.trackingNumber === trk)) {
                  const weight = Number(weightKg) || 0;
                  const price = Number((weight * devRates.pricePerKg).toFixed(2));
                  devParcels.unshift({
                    id: `p_dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    trackingNumber: trk,
                    customerCode: customerCode || devUser.customerCode,
                    status: status as any,
                    paymentStatus: 'pending',
                    weightKg: weight,
                    amount: price,
                    currency: 'USD',
                    chinaDate: new Date().toLocaleDateString('ru-RU'),
                    estimatedArrival: 'Aniqlanmoqda',
                    cargoSubmittedAt: null,
                    deliveryBranchSnapshot: branchSnapshot,
                    createdAt: new Date().toISOString(),
                  });
                  addedCount++;
                }
              }

              return sendJson(res, 201, {
                success: true,
                message: `${addedCount} ta yangi trek kiritildi`,
                parcels: devParcels,
              });
            }
          }

          // Cargo providers (China Warehouse Settings)
          if (path === '/api/admin/cargo-providers') {
            if (req.method === 'GET') {
              return sendJson(res, 200, [devWarehouse]);
            }
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              if (body.receiver_name !== undefined) devWarehouse.receiver_name = body.receiver_name;
              if (body.phone !== undefined) devWarehouse.phone = body.phone;
              if (body.province !== undefined) devWarehouse.province = body.province;
              if (body.city !== undefined) devWarehouse.city = body.city;
              if (body.warehouse_code !== undefined) devWarehouse.warehouse_code = body.warehouse_code;
              if (body.address_template !== undefined) devWarehouse.address_template = body.address_template;
              return sendJson(res, 200, {
                success: true,
                message: 'Xitoy ombor manzili muvaffaqiyatli yangilandi',
                warehouse: devWarehouse,
              });
            }
          }

          if (path === '/api/admin/location-requests') {
            return sendJson(res, 200, []);
          }

          // System Settings (Rates & Support)
          if (path === '/api/admin/settings') {
            if (req.method === 'GET') {
              return sendJson(res, 200, devRates);
            }
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              if (body.pricePerKg !== undefined) devRates.pricePerKg = Number(body.pricePerKg);
              if (body.exchangeRate !== undefined) devRates.exchangeRate = Number(body.exchangeRate);
              if (body.supportUsername !== undefined) devRates.supportUsername = String(body.supportUsername);

              // Recalculate parcel amounts if pricePerKg changed
              devParcels.forEach(p => {
                if (p.weightKg > 0) {
                  p.amount = Number((p.weightKg * devRates.pricePerKg).toFixed(2));
                }
              });

              return sendJson(res, 200, {
                success: true,
                message: 'Tariflar va sozlamalar muvaffaqiyatli saqlandi',
                settings: devRates,
              });
            }
          }
        }

        // 9. Bot Webhook
        if (path === '/api/bot/webhook' && req.method === 'POST') {
          const body = await readBody(req);
          try {
            await processTelegramUpdate(body);
          } catch (err: any) {
            console.error('Bot webhook error:', err.message);
          }
          return sendJson(res, 200, { ok: true });
        }

        // Default response for unmatched /api/*
        return sendJson(res, 404, { error: `Endpoint topilmadi: ${path}` });
      });
    },
  };
}
