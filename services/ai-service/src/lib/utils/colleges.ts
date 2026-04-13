/**
 * College slug to Name mapping for web search query prefixing
 * Uses slug as ID to match admin-dashboard format (e.g., "gpc-ajmer")
 */

export interface College {
  id: string; // This is the slug (e.g., "gpc-ajmer")
  name: string;
}

export const colleges: College[] = [
  { id: "gpc-ajmer", name: "Government Polytechnic College, Ajmer" },
  { id: "gpc-alwar", name: "Government Polytechnic College, Alwar" },
  {
    id: "gpc-bagidora-banswara",
    name: "Government Polytechnic College Bagidora, Banswara",
  },
  { id: "gpc-banswara", name: "Government Polytechnic College, Banswara" },
  { id: "gpc-baran", name: "Government Polytechnic College, Baran" },
  { id: "gpc-barmer", name: "Government Polytechnic College, Barmer" },
  { id: "gpc-bikaner", name: "Government Polytechnic College, Bikaner" },
  {
    id: "sgv-gpc-bharatpur",
    name: "Shri Gokul Verma Government Polytechnic College, Bharatpur",
  },
  { id: "gpc-bhilwara", name: "Government Polytechnic College Bhilwara" },
  { id: "gpc-bundi", name: "Government Polytechnic College, Bundi" },
  { id: "gpc-chittorgarh", name: "Government Polytechnic College Chittorgarh" },
  { id: "gpc-churu", name: "Government Polytechnic College, Churu" },
  {
    id: "rpgpc-dausa",
    name: "Rajesh Pilot Government Polytechnic College, Dausa",
  },
  {
    id: "rpgpc-dholpur",
    name: "Rajesh Pilot Government Polytechnic College, Dholpur",
  },
  { id: "gpc-dungarpur", name: "Government Polytechnic College, Dungarpur" },
  {
    id: "gpc-hanumangarh",
    name: "Government Polytechnic College, Hanumangarh",
  },
  {
    id: "grckpc-jaipur",
    name: "Government Ram Chandra Khaitan Polytechnic College Jaipur",
  },
  {
    id: "gpc-jalore-pali",
    name: "Government Polytechnic College, Jalore (Camp Pali)",
  },
  { id: "gpc-jaisalmer", name: "Government Polytechnic College, Jaisalmer" },
  { id: "gpc-jhalawar", name: "Government Polytechnic College, Jhalawar" },
  { id: "gpc-jodhpur", name: "Government Polytechnic College, Jodhpur" },
  { id: "gpc-jhunjhunu", name: "Government Polytechnic College, Jhunjhunu" },
  {
    id: "gpc-karauli-alwar",
    name: "Government Polytechnic College, Karauli (Camp- Alwar)",
  },
  { id: "gpc-kota", name: "Government Polytechnic College, Kota" },
  { id: "gpc-kelwara", name: "Government Polytechnic College, Kelwara" },
  { id: "gpc-mandore", name: "Government Polytechnic College, Mandore" },
  { id: "gpc-nagaur", name: "Government Polytechnic College, Nagaur" },
  {
    id: "gpc-neemrana",
    name: "Government Polytechnic College Neemrana (Alwar)-Rajasthan",
  },
  { id: "gpc-pali", name: "Government Polytechnic College Pali" },
  { id: "gpc-pratapgarh", name: "Government Polytechnic College Pratapgarh" },
  { id: "gpc-rajsamand", name: "Government Polytechnic College, Rajsamand" },
  {
    id: "gpc-sawai-madhopur",
    name: "Government Polytechnic College, Sawai Madhopur",
  },
  { id: "gpc-sikar", name: "Govt. Polytechnic College, Sikar" },
  {
    id: "sgbb-gpc-sirohi",
    name: "SGBB Government Polytechnic College Sirohi (Raj.)",
  },
  {
    id: "cmrb-gpc-sriganganagar",
    name: "CMRB Government Polytechnic College, Sriganganagar",
  },
  { id: "gpc-tonk", name: "Government Polytechnic College, Tonk" },
  { id: "gpc-udaipur", name: "Government Polytechnic College, Udaipur" },
  { id: "gwpc-ajmer", name: "Government Women Polytechnic College, Ajmer" },
  { id: "gwpc-bikaner", name: "Government Women Polytechnic College, Bikaner" },
  {
    id: "gwpc-bharatpur",
    name: "Government Women Polytechnic College Bharatpur",
  },
  { id: "gwpc-jaipur", name: "Government Women Polytechnic College, Jaipur" },
  {
    id: "grwpc-jodhpur",
    name: "Government Residential Women Polytechnic College, Jodhpur",
  },
  { id: "gwpc-kota", name: "Government Women Polytechnic College, Kota" },
  {
    id: "gwpc-sanganer",
    name: "Government Women Polytechnic College, Sanganer",
  },
  { id: "gwpc-udaipur", name: "Government Women Polytechnic College, Udaipur" },
  { id: "ttc-lrdc-jodhpur", name: "TTC, LRDC Jodhpur" },
];

/**
 * Get college by ID
 */
export function getCollegeById(id: string): College | undefined {
  return colleges.find((c) => c.id === id);
}

/**
 * Get college name by ID, returns undefined if not found
 */
export function getCollegeNameById(id: string): string | undefined {
  return getCollegeById(id)?.name;
}
