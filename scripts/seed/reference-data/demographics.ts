// Demographics reference data for seed script

export const FIRST_NAMES_MALE: string[] = [
  'James', 'Michael', 'David', 'Robert', 'John', 'William', 'Richard', 'Joseph',
  'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven',
  'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy',
  'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas',
  'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
  'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis',
  'Jerry', 'Tyler', 'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Douglas', 'Zachary',
  'Peter', 'Kyle', 'Noah', 'Ethan', 'Jeremy', 'Walter', 'Christian', 'Keith',
  'Marcus', 'Carlos',
];

export const FIRST_NAMES_FEMALE: string[] = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley',
  'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa',
  'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy',
  'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine',
  'Maria', 'Heather', 'Diane', 'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia',
  'Victoria', 'Kelly', 'Lauren', 'Christina', 'Joan', 'Evelyn', 'Judith', 'Megan',
  'Rosa', 'Ayesha',
];

export const LAST_NAMES: string[] = [
  // Native American-inspired surnames
  'Whitehorse', 'Blackbear', 'Redhawk', 'Standingbear', 'Runningdeer', 'Littlefeather',
  'Eaglefeather', 'Thunderhawk', 'Morningstar', 'Silvercloud', 'Strongbow', 'Swiftwater',
  'Greywolf', 'Sunflower', 'Bluejay', 'Tallchief', 'Brightwater', 'Clearsky',
  'Windwalker', 'Stonecrow', 'Ironhawk', 'Raindrop', 'Riverbend', 'Meadowlark',
  'Pineleaf', 'Cedarwood', 'Wildrose', 'Snowbird', 'Foxrun', 'Birdsong',
  // Common American surnames
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
];

export const STREET_ADDRESSES: string[] = [
  '123 Elm Street',
  '456 Oak Avenue',
  '789 Pine Road',
  '321 Cedar Lane',
  '654 Birch Drive',
  '987 Maple Court',
  '147 Spruce Way',
  '258 Aspen Trail',
  '369 Willow Street',
  '741 Cottonwood Boulevard',
  '852 Juniper Road',
  '963 Sage Lane',
  '174 Mesquite Avenue',
  '285 Pinon Way',
  '396 Cactus Drive',
  '507 Arroyo Lane',
  '618 Pueblo Road',
  '729 Canyon Drive',
  '840 Mesa Court',
  '951 Rio Grande Boulevard',
  '1020 Turquoise Trail',
  '1135 Adobe Way',
  '1247 Kiva Circle',
  '1358 Pueblo Drive',
  '1469 Desert Sage Road',
  '1580 Red Rock Lane',
  '1691 Thunderbird Avenue',
  '1802 Eagle Nest Road',
  '1913 Prairie Wind Drive',
  '2024 Buffalo Run Court',
  '2135 Medicine Wheel Path',
  '2246 Sacred Springs Way',
];

export interface CityState {
  city: string;
  state: string;
  zip: string;
}

export const CITIES_STATES: CityState[] = [
  // New Mexico
  { city: 'Albuquerque', state: 'NM', zip: '87101' },
  { city: 'Gallup', state: 'NM', zip: '87301' },
  { city: 'Santa Fe', state: 'NM', zip: '87501' },
  { city: 'Shiprock', state: 'NM', zip: '87420' },
  { city: 'Farmington', state: 'NM', zip: '87401' },
  { city: 'Las Cruces', state: 'NM', zip: '88001' },
  { city: 'Espanola', state: 'NM', zip: '87532' },
  { city: 'Zuni', state: 'NM', zip: '87327' },
  { city: 'Taos', state: 'NM', zip: '87571' },
  { city: 'Laguna', state: 'NM', zip: '87026' },
  { city: 'Crownpoint', state: 'NM', zip: '87313' },
  { city: 'Socorro', state: 'NM', zip: '87801' },
  { city: 'Bernalillo', state: 'NM', zip: '87004' },
  // Arizona
  { city: 'Tuba City', state: 'AZ', zip: '86045' },
  { city: 'Window Rock', state: 'AZ', zip: '86515' },
  { city: 'Chinle', state: 'AZ', zip: '86503' },
  { city: 'Flagstaff', state: 'AZ', zip: '86001' },
  { city: 'Whiteriver', state: 'AZ', zip: '85941' },
  // Oklahoma
  { city: 'Tahlequah', state: 'OK', zip: '74464' },
  { city: 'Muskogee', state: 'OK', zip: '74401' },
  { city: 'Ada', state: 'OK', zip: '74820' },
  { city: 'Lawton', state: 'OK', zip: '73501' },
  // Montana
  { city: 'Browning', state: 'MT', zip: '59417' },
  { city: 'Crow Agency', state: 'MT', zip: '59022' },
  { city: 'Lame Deer', state: 'MT', zip: '59043' },
  // Alaska
  { city: 'Bethel', state: 'AK', zip: '99559' },
  { city: 'Barrow', state: 'AK', zip: '99723' },
  { city: 'Nome', state: 'AK', zip: '99762' },
  // South Dakota
  { city: 'Pine Ridge', state: 'SD', zip: '57770' },
  { city: 'Rosebud', state: 'SD', zip: '57570' },
  { city: 'Eagle Butte', state: 'SD', zip: '57625' },
];

export interface RaceCode {
  code: string;
  display: string;
  system: string;
}

export const RACE_CODES: RaceCode[] = [
  { code: '1002-5', display: 'American Indian or Alaska Native', system: 'urn:oid:2.16.840.1.113883.6.238' },
  { code: '2028-9', display: 'Asian', system: 'urn:oid:2.16.840.1.113883.6.238' },
  { code: '2054-5', display: 'Black or African American', system: 'urn:oid:2.16.840.1.113883.6.238' },
  { code: '2076-8', display: 'White', system: 'urn:oid:2.16.840.1.113883.6.238' },
  { code: '2106-3', display: 'Native Hawaiian or Other Pacific Islander', system: 'urn:oid:2.16.840.1.113883.6.238' },
  { code: '2131-1', display: 'Other Race', system: 'urn:oid:2.16.840.1.113883.6.238' },
];

export const ETHNICITY_OPTIONS: string[] = [
  'Hispanic or Latino',
  'Non-Hispanic/Latino',
  'Unknown',
];

export const LANGUAGES: string[] = [
  'English',
  'Spanish',
  'Navajo',
  'Cherokee',
  'Lakota',
  'Chinese',
  'Vietnamese',
];

export const PAYER_NAMES: string[] = [
  'Indian Health Service',
  'Medicaid',
  'Medicare',
  'Blue Cross Blue Shield',
  'UnitedHealthcare',
  'Aetna',
  'Cigna',
  'Humana',
  'Tricare',
];

export const PLAN_TYPES: string[] = [
  'HMO',
  'PPO',
  'Medicaid',
  'Medicare',
  'TRICARE',
  'Other',
];

export const RELATIONSHIPS: string[] = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Friend',
  'Other',
];
