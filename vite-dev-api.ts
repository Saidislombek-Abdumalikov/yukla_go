import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { processTelegramUpdate } from './api/_lib/botEngine';

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
    provider: 'BTS',
    branchName: 'BTS Chorsu',
    region: 'Namangan',
    address: 'Namangan sh., Chorsu dahasi, 12-uy',
  },
};

const devBranches = [
  { id: 'b_1', provider: 'BTS', branch_name: 'BTS Chorsu', branchName: 'BTS Chorsu', region: 'Namangan', address: 'Namangan sh., Chorsu dahasi, 12-uy' },
  { id: 'b_2', provider: 'BTS', branch_name: 'BTS Chilonzor', branchName: 'BTS Chilonzor', region: 'Toshkent', address: 'Chilonzor 9-mavze, Qatortol 1' },
  { id: 'b_3', provider: 'BTS', branch_name: 'BTS Samarqand Markaz', branchName: 'BTS Samarqand Markaz', region: 'Samarqand', address: 'Mirzo Ulug\'bek ko\'chasi 45' },
  { id: 'b_4', provider: 'EMU', branch_name: 'EMU Yunusobod', branchName: 'EMU Yunusobod', region: 'Toshkent', address: 'Yunusobod 4-mavze, 15-uy' },
  { id: 'b_5', provider: 'EMU', branch_name: 'EMU Chortoq', branchName: 'EMU Chortoq', region: 'Namangan', address: 'Mustaqillik ko\'chasi 10' },
  { id: 'b_6', provider: 'UZPOST', branch_name: 'Bosh Pochtampt', branchName: 'Bosh Pochtampt', region: 'Toshkent', address: 'Shahrisabz ko\'chasi 7' },
];

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
    deliveryBranchSnapshot: devUser.defaultDeliveryBranch,
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
    deliveryBranchSnapshot: devUser.defaultDeliveryBranch,
    createdAt: '2026-10-01T08:30:00.000Z',
  },
  {
    id: 'p_3',
    trackingNumber: 'JT382910381CN',
    customerCode: 'YK-100',
    status: 'uzbekistan',
    paymentStatus: 'paid',
    weightKg: 4.8,
    amount: 45.60,
    currency: 'USD',
    chinaDate: '20.09.2026',
    estimatedArrival: '02.10.2026',
    deliveryBranchSnapshot: devUser.defaultDeliveryBranch,
    createdAt: '2026-09-20T14:15:00.000Z',
  },
  {
    id: 'p_4',
    trackingNumber: 'YT771928371CN',
    customerCode: 'YK-100',
    status: 'delivered',
    paymentStatus: 'paid',
    weightKg: 2.1,
    amount: 19.95,
    currency: 'USD',
    chinaDate: '10.09.2026',
    estimatedArrival: '18.09.2026',
    deliveryBranchSnapshot: devUser.defaultDeliveryBranch,
    createdAt: '2026-09-10T11:00:00.000Z',
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

        // 3. Warehouse address
        if (path === '/api/config/warehouse') {
          return sendJson(res, 200, {
            receiver: `Yukla Go (${devUser.customerCode})`,
            phone: '13335957161',
            region: '浙江省金华市义乌市',
            address: `077库房/70099号 ${devUser.customerCode}`,
            customerCode: devUser.customerCode,
          });
        }

        // 4. Shipping rates
        if (path === '/api/config/rates') {
          return sendJson(res, 200, {
            pricePerKg: 9.5,
            exchangeRate: 12850,
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

        // 7. Parcels GET / POST
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
            return sendJson(res, 200, {
              totalUsers: 142,
              activeParcels: devParcels.filter(p => p.status !== 'delivered').length,
              deliveredParcels: devParcels.filter(p => p.status === 'delivered').length,
              pendingLocationRequests: 2,
            });
          }
          if (path === '/api/admin/users') {
            return sendJson(res, 200, [devUser]);
          }
          if (path === '/api/admin/parcels') {
            return sendJson(res, 200, devParcels);
          }
          if (path === '/api/admin/cargo-providers') {
            return sendJson(res, 200, [
              {
                id: 'cp_1',
                name: 'Yukla Go Yiwu Primary',
                warehouse_code: '077库房',
                province: 'Zhejiang',
                city: 'Yiwu',
                full_address: 'Beiyuan Industrial District, No. 88',
                phone: '13335957161',
                active: true,
              },
            ]);
          }
          if (path === '/api/admin/location-requests') {
            return sendJson(res, 200, []);
          }
          if (path === '/api/admin/settings') {
            return sendJson(res, 200, {
              cargoRates: { price_per_kg: 9.5 },
              exchangeRate: { usd_to_uzs: 12850 },
            });
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
