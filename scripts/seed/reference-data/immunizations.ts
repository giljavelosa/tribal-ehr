// Immunization reference data with CVX codes

export interface Immunization {
  cvxCode: string;
  display: string;
  minAge: number;   // minimum age in years
  maxAge: number;   // maximum age in years (999 = no upper limit)
  series: string;
  dosesRequired: number;
}

export const IMMUNIZATIONS: Immunization[] = [
  // COVID-19 vaccines (all ages 6mo+)
  {
    cvxCode: '208',
    display: 'COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose',
    minAge: 5,
    maxAge: 999,
    series: 'COVID-19 Primary',
    dosesRequired: 2,
  },
  {
    cvxCode: '213',
    display: 'COVID-19, mRNA, LNP-S, PF, 50 mcg/0.25 mL dose, bivalent',
    minAge: 12,
    maxAge: 999,
    series: 'COVID-19 Bivalent Booster',
    dosesRequired: 1,
  },

  // Influenza (all ages 6mo+)
  {
    cvxCode: '197',
    display: 'Influenza, inactivated, quadrivalent, adjuvanted, PF',
    minAge: 0,
    maxAge: 999,
    series: 'Influenza Annual',
    dosesRequired: 1,
  },

  // Pneumococcal (adults 65+)
  {
    cvxCode: '33',
    display: 'Pneumococcal polysaccharide PPV23',
    minAge: 65,
    maxAge: 999,
    series: 'Pneumococcal Adult',
    dosesRequired: 1,
  },

  // Tdap / Td
  {
    cvxCode: '115',
    display: 'Tdap',
    minAge: 11,
    maxAge: 999,
    series: 'Tdap Booster',
    dosesRequired: 1,
  },
  {
    cvxCode: '113',
    display: 'Td (adult) preservative free',
    minAge: 18,
    maxAge: 999,
    series: 'Td Booster',
    dosesRequired: 1,
  },

  // Shingrix (adults 50+)
  {
    cvxCode: '187',
    display: 'Zoster vaccine recombinant (Shingrix)',
    minAge: 50,
    maxAge: 999,
    series: 'Shingrix',
    dosesRequired: 2,
  },

  // Hepatitis B (all ages)
  {
    cvxCode: '43',
    display: 'Hepatitis B, adult',
    minAge: 18,
    maxAge: 999,
    series: 'Hep B Adult',
    dosesRequired: 3,
  },

  // MMR (childhood, catch-up in adults)
  {
    cvxCode: '03',
    display: 'MMR (Measles, Mumps, Rubella)',
    minAge: 1,
    maxAge: 17,
    series: 'MMR Childhood',
    dosesRequired: 2,
  },

  // Varicella (childhood)
  {
    cvxCode: '21',
    display: 'Varicella',
    minAge: 1,
    maxAge: 17,
    series: 'Varicella Childhood',
    dosesRequired: 2,
  },

  // DTaP (childhood)
  {
    cvxCode: '20',
    display: 'DTaP',
    minAge: 0,
    maxAge: 6,
    series: 'DTaP Childhood',
    dosesRequired: 5,
  },

  // IPV (childhood)
  {
    cvxCode: '10',
    display: 'IPV (Inactivated Poliovirus)',
    minAge: 0,
    maxAge: 17,
    series: 'IPV Childhood',
    dosesRequired: 4,
  },

  // Hib (childhood)
  {
    cvxCode: '48',
    display: 'Hib (Haemophilus influenzae type b)',
    minAge: 0,
    maxAge: 4,
    series: 'Hib Childhood',
    dosesRequired: 4,
  },

  // PCV13 (childhood)
  {
    cvxCode: '133',
    display: 'PCV13 (Pneumococcal conjugate)',
    minAge: 0,
    maxAge: 4,
    series: 'PCV13 Childhood',
    dosesRequired: 4,
  },

  // Rotavirus (infant)
  {
    cvxCode: '116',
    display: 'Rotavirus, pentavalent',
    minAge: 0,
    maxAge: 0,
    series: 'Rotavirus Infant',
    dosesRequired: 3,
  },

  // Hepatitis A
  {
    cvxCode: '83',
    display: 'Hepatitis A, pediatric/adolescent, 2 dose',
    minAge: 1,
    maxAge: 17,
    series: 'Hep A Childhood',
    dosesRequired: 2,
  },
];
