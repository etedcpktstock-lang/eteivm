import { useMemo } from 'react';

/**
 * 🗺️ useThaiAddress Hook
 * Safely derives available districts and subdistricts based on the cascading Thai address structure.
 */
export function useThaiAddress(thaiAddressData: any[], province: string, district: string) {
  const availableDistricts = useMemo(() => {
    if (!province || !Array.isArray(thaiAddressData)) return [];
    
    // Find the province object
    const p = thaiAddressData.find((prov: any) => prov.name_th === province);
    
    // Return sorted districts (amphure)
    return (p && Array.isArray(p.amphure)) 
      ? p.amphure.map((a: any) => a.name_th).sort() 
      : [];
  }, [province, thaiAddressData]);

  const availableSubdistricts = useMemo(() => {
    if (!province || !district || !Array.isArray(thaiAddressData)) return [];
    
    // Find the province
    const p = thaiAddressData.find((prov: any) => prov.name_th === province);
    if (!p || !Array.isArray(p.amphure)) return [];
    
    // Find the district (amphure)
    const a = p.amphure.find((amp: any) => amp.name_th === district);
    
    // Return sorted subdistricts (tambon)
    return (a && Array.isArray(a.tambon)) 
      ? a.tambon.sort((x: any, y: any) => (x.name_th || '').localeCompare(y.name_th || '')) 
      : [];
  }, [province, district, thaiAddressData]);

  return { availableDistricts, availableSubdistricts };
}
