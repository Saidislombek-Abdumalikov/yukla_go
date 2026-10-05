/**
 * ==============================================================================
 * YUKLA GO - COMPREHENSIVE DELIVERY BRANCHES DIRECTORY
 * ==============================================================================
 * Complete directory of branches for BTS Express, EMU Express, and UzPost
 * covering all 14 regions and major cities of Uzbekistan.
 */

export interface BranchItem {
  id: string;
  provider: 'BTS' | 'EMU' | 'UZPOST';
  branchName: string;
  region: string;
  address: string;
  phone?: string;
}

export const REGIONS_LIST: string[] = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Farg\'ona viloyati',
  'Namangan viloyati',
];

export const ALL_BRANCHES: BranchItem[] = [
  // ---------------------------------------------------------------------------
  // 1. Toshkent shahri
  // ---------------------------------------------------------------------------
  { id: 'bts_tosh_chilonzor', provider: 'BTS', branchName: 'BTS Chilonzor', region: 'Toshkent shahri', address: 'Chilonzor 9-mavze, Qatortol 1' },
  { id: 'bts_tosh_yunusobod', provider: 'BTS', branchName: 'BTS Yunusobod', region: 'Toshkent shahri', address: 'Yunusobod 11-mavze, Ahmad Donish 44' },
  { id: 'bts_tosh_chorsu', provider: 'BTS', branchName: 'BTS Chorsu', region: 'Toshkent shahri', address: 'Navoiy shoh ko\'chasi 32' },
  { id: 'bts_tosh_mirobod', provider: 'BTS', branchName: 'BTS Mirobod', region: 'Toshkent shahri', address: 'Nukus ko\'chasi 29' },
  { id: 'bts_tosh_sergeli', provider: 'BTS', branchName: 'BTS Sergeli', region: 'Toshkent shahri', address: 'Yangisirgli ko\'chasi 14' },

  { id: 'emu_tosh_yunusobod', provider: 'EMU', branchName: 'EMU Yunusobod', region: 'Toshkent shahri', address: 'Yunusobod 4-mavze, 15-uy' },
  { id: 'emu_tosh_chilonzor', provider: 'EMU', branchName: 'EMU Chilonzor', region: 'Toshkent shahri', address: 'Muqimiy ko\'chasi 76' },
  { id: 'emu_tosh_mirobod', provider: 'EMU', branchName: 'EMU Mirobod (Oybek)', region: 'Toshkent shahri', address: 'Oybek ko\'chasi 18' },
  { id: 'emu_tosh_olmazor', provider: 'EMU', branchName: 'EMU Olmazor', region: 'Toshkent shahri', address: 'Qorasaroy ko\'chasi 12' },
  { id: 'emu_tosh_sergeli', provider: 'EMU', branchName: 'EMU Sergeli', region: 'Toshkent shahri', address: 'Cho\'ponota ko\'chasi 5' },

  { id: 'uzp_tosh_glavpocht', provider: 'UZPOST', branchName: 'Bosh Pochtampt 100000', region: 'Toshkent shahri', address: 'Shahrisabz ko\'chasi 7' },
  { id: 'uzp_tosh_chilonzor', provider: 'UZPOST', branchName: 'UzPost Chilonzor', region: 'Toshkent shahri', address: 'Chilonzor 2-mavze, 10-uy' },
  { id: 'uzp_tosh_yunusobod', provider: 'UZPOST', branchName: 'UzPost Yunusobod', region: 'Toshkent shahri', address: 'Yunusobod 7-mavze' },

  // ---------------------------------------------------------------------------
  // 2. Toshkent viloyati
  // ---------------------------------------------------------------------------
  { id: 'bts_toshvil_chirchiq', provider: 'BTS', branchName: 'BTS Chirchiq', region: 'Toshkent viloyati', address: 'A. Navoiy ko\'chasi 25' },
  { id: 'bts_toshvil_olmaliq', provider: 'BTS', branchName: 'BTS Olmaliq', region: 'Toshkent viloyati', address: 'Metallurglar ko\'chasi 10' },
  { id: 'bts_toshvil_angren', provider: 'BTS', branchName: 'BTS Angren', region: 'Toshkent viloyati', address: 'Mustaqillik ko\'chasi 8' },
  { id: 'bts_toshvil_bekobod', provider: 'BTS', branchName: 'BTS Bekobod', region: 'Toshkent viloyati', address: 'S. Ayniy ko\'chasi 14' },

  { id: 'emu_toshvil_chirchiq', provider: 'EMU', branchName: 'EMU Chirchiq', region: 'Toshkent viloyati', address: 'Lomonosov ko\'chasi 3' },
  { id: 'emu_toshvil_olmaliq', provider: 'EMU', branchName: 'EMU Olmaliq', region: 'Toshkent viloyati', address: 'Amir Temur ko\'chasi 19' },
  { id: 'emu_toshvil_bekobod', provider: 'EMU', branchName: 'EMU Bekobod', region: 'Toshkent viloyati', address: 'Yoshlik ko\'chasi 2' },

  { id: 'uzp_toshvil_chirchiq', provider: 'UZPOST', branchName: 'UzPost Chirchiq Markaz', region: 'Toshkent viloyati', address: 'Navoiy shoh 12' },
  { id: 'uzp_toshvil_olmaliq', provider: 'UZPOST', branchName: 'UzPost Olmaliq Markaz', region: 'Toshkent viloyati', address: 'Metallurglar 5' },

  // ---------------------------------------------------------------------------
  // 3. Andijon viloyati
  // ---------------------------------------------------------------------------
  { id: 'bts_and_markaz', provider: 'BTS', branchName: 'BTS Andijon Markaz', region: 'Andijon viloyati', address: 'Bobur shoh ko\'chasi 45' },
  { id: 'bts_and_asaka', provider: 'BTS', branchName: 'BTS Asaka', region: 'Andijon viloyati', address: 'O\'zbekiston ko\'chasi 12' },
  { id: 'bts_and_shahrixon', provider: 'BTS', branchName: 'BTS Shahrixon', region: 'Andijon viloyati', address: 'Mustaqillik ko\'chasi 22' },

  { id: 'emu_and_markaz', provider: 'EMU', branchName: 'EMU Andijon Markaz', region: 'Andijon viloyati', address: 'Mashrab ko\'chasi 18' },
  { id: 'emu_and_asaka', provider: 'EMU', branchName: 'EMU Asaka', region: 'Andijon viloyati', address: 'Navoiy ko\'chasi 9' },
  { id: 'emu_and_qorgontepa', provider: 'EMU', branchName: 'EMU Qo\'rg\'ontepa', region: 'Andijon viloyati', address: 'Istiqlol ko\'chasi 4' },

  { id: 'uzp_and_markaz', provider: 'UZPOST', branchName: 'UzPost Andijon Bosh Pochtampt', region: 'Andijon viloyati', address: 'Navoiy shoh 31' },
  { id: 'uzp_and_asaka', provider: 'UZPOST', branchName: 'UzPost Asaka', region: 'Andijon viloyati', address: 'Bobur shoh 14' },

  // ---------------------------------------------------------------------------
  // 4. Farg'ona viloyati
  // ---------------------------------------------------------------------------
  { id: 'bts_far_markaz', provider: 'BTS', branchName: 'BTS Farg\'ona Markaz', region: 'Farg\'ona viloyati', address: 'Al-Farg\'oniy ko\'chasi 78' },
  { id: 'bts_far_qoqon', provider: 'BTS', branchName: 'BTS Qo\'qon', region: 'Farg\'ona viloyati', address: 'Turkiston ko\'chasi 54' },
  { id: 'bts_far_margilon', provider: 'BTS', branchName: 'BTS Marg\'ilon', region: 'Farg\'ona viloyati', address: 'B. Marg\'iloniy ko\'chasi 11' },

  { id: 'emu_far_markaz', provider: 'EMU', branchName: 'EMU Farg\'ona Markaz', region: 'Farg\'ona viloyati', address: 'Marfua ko\'chasi 21' },
  { id: 'emu_far_qoqon', provider: 'EMU', branchName: 'EMU Qo\'qon', region: 'Farg\'ona viloyati', address: 'Charxiy ko\'chasi 15' },
  { id: 'emu_far_margilon', provider: 'EMU', branchName: 'EMU Marg\'ilon', region: 'Farg\'ona viloyati', address: 'Xiyobon ko\'chasi 6' },

  { id: 'uzp_far_markaz', provider: 'UZPOST', branchName: 'UzPost Farg\'ona Bosh Pochtampt', region: 'Farg\'ona viloyati', address: 'Al-Farg\'oniy 5' },
  { id: 'uzp_far_qoqon', provider: 'UZPOST', branchName: 'UzPost Qo\'qon', region: 'Farg\'ona viloyati', address: 'Turkiston 10' },

  // ---------------------------------------------------------------------------
  // 5. Namangan viloyati
  // ---------------------------------------------------------------------------
  { id: 'bts_nam_chorsu', provider: 'BTS', branchName: 'BTS Chorsu Markaz', region: 'Namangan viloyati', address: 'Namangan sh., Chorsu dahasi, 12-uy' },
  { id: 'bts_nam_kosonsoy', provider: 'BTS', branchName: 'BTS Kosonsoy', region: 'Namangan viloyati', address: 'Toshkent ko\'chasi 15' },
  { id: 'bts_nam_chust', provider: 'BTS', branchName: 'BTS Chust', region: 'Namangan viloyati', address: 'Tinchlik ko\'chasi 8' },
  { id: 'bts_nam_uchqorgon', provider: 'BTS', branchName: 'BTS Uchqo\'rg\'on', region: 'Namangan viloyati', address: 'Do\'stlik ko\'chasi 4' },

  { id: 'emu_nam_markaz', provider: 'EMU', branchName: 'EMU Namangan Markaz', region: 'Namangan viloyati', address: 'To\'raqo\'rg\'on ko\'chasi 42' },
  { id: 'emu_nam_chortoq', provider: 'EMU', branchName: 'EMU Chortoq', region: 'Namangan viloyati', address: 'Mustaqillik ko\'chasi 10' },
  { id: 'emu_nam_pop', provider: 'EMU', branchName: 'EMU Pop', region: 'Namangan viloyati', address: 'Navoiy ko\'chasi 22' },

  { id: 'uzp_nam_markaz', provider: 'UZPOST', branchName: 'UzPost Namangan Bosh Pochtampt', region: 'Namangan viloyati', address: 'Navoiy ko\'chasi 36' },
  { id: 'uzp_nam_chust', provider: 'UZPOST', branchName: 'UzPost Chust Markaz', region: 'Namangan viloyati', address: 'Tinchlik ko\'chasi 1' },

];

export function getBranches(provider?: string, region?: string): BranchItem[] {
  let list = ALL_BRANCHES;
  if (provider) {
    const provUpper = provider.toUpperCase();
    list = list.filter(b => b.provider === provUpper);
  }
  if (region) {
    const regLower = region.toLowerCase().trim();
    list = list.filter(b => b.region.toLowerCase().includes(regLower) || regLower.includes(b.region.toLowerCase()));
  }
  return list;
}

export function getRegionsForProvider(provider: string): string[] {
  const provUpper = provider.toUpperCase();
  const branches = ALL_BRANCHES.filter(b => b.provider === provUpper);
  return Array.from(new Set(branches.map(b => b.region)));
}

export function findBranchById(id: string): BranchItem | undefined {
  return ALL_BRANCHES.find(b => b.id === id);
}
