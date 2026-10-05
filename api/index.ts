import type { VercelRequest, VercelResponse } from '@vercel/node';

import handleAcademyCourses from './_handlers/academyCourses.ts';
import handleAcademyProgress from './_handlers/academyProgress.ts';
import handleAcademyRequestAccess from './_handlers/academyRequestAccess.ts';
import handleAdminAcademy from './_handlers/adminAcademy.ts';
import handleAdminCargoProviders from './_handlers/adminCargoProviders.ts';
import handleAdminLocationRequests from './_handlers/adminLocationRequests.ts';
import handleAdminParcels from './_handlers/adminParcels.ts';
import handleAdminSettings from './_handlers/adminSettings.ts';
import handleAdminStats from './_handlers/adminStats.ts';
import handleAdminUsers from './_handlers/adminUsers.ts';
import handleAuthSession from './_handlers/authSession.ts';
import handleBotWebhook from './_handlers/botWebhook.ts';
import handleBranches from './_handlers/branches.ts';
import handleConfigRates from './_handlers/configRates.ts';
import handleConfigWarehouse from './_handlers/configWarehouse.ts';
import handleParcels from './_handlers/parcels.ts';
import handleUserLocationRequest from './_handlers/userLocationRequest.ts';
import handleUserMe from './_handlers/userMe.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = req.url || '';
  const urlObj = new URL(rawUrl, 'http://localhost');
  let pathname = urlObj.pathname.replace(/\/$/, '');

  const pathParam = req.query?.__path;
  const normalizedPath = (pathname === '/api' || pathname === '') && pathParam
    ? `/api/${String(pathParam).replace(/^\//, '').split('?')[0]}`
    : pathname;

  switch (normalizedPath) {
    case '/api/bot/webhook':
      return handleBotWebhook(req, res);

    case '/api/auth/session':
      return handleAuthSession(req, res);

    case '/api/user/me':
      return handleUserMe(req, res);

    case '/api/user/location-request':
      return handleUserLocationRequest(req, res);

    case '/api/config/warehouse':
      return handleConfigWarehouse(req, res);

    case '/api/config/rates':
      return handleConfigRates(req, res);

    case '/api/branches':
      return handleBranches(req, res);

    case '/api/parcels':
      return handleParcels(req, res);

    case '/api/academy/courses':
      return handleAcademyCourses(req, res);

    case '/api/academy/progress':
      return handleAcademyProgress(req, res);

    case '/api/academy/request-access':
      return handleAcademyRequestAccess(req, res);

    case '/api/admin/academy':
      return handleAdminAcademy(req, res);

    case '/api/admin/cargo-providers':
      return handleAdminCargoProviders(req, res);

    case '/api/admin/location-requests':
      return handleAdminLocationRequests(req, res);

    case '/api/admin/parcels':
      return handleAdminParcels(req, res);

    case '/api/admin/settings':
      return handleAdminSettings(req, res);

    case '/api/admin/stats':
      return handleAdminStats(req, res);

    case '/api/admin/users':
      return handleAdminUsers(req, res);

    default:
      return res.status(404).json({
        error: 'API endpoint topilmadi',
        path: normalizedPath,
      });
  }
}
