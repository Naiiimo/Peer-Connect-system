export const SCHOOLS = [
  "School of Pharmacy and Health Sciences",
  "Chandaria School of Business",
  "School of Humanities & Social Sciences",
  "School of Communication, Cinematic and Creative Arts",
  "School of Science and Technology",
] as const;

export type School = (typeof SCHOOLS)[number];

export const YEARS = [1, 2, 3, 4, 5] as const;
export const LEARNING_STYLES = ["visual", "auditory", "reading", "kinesthetic"] as const;
export const GENDERS = ["male", "female", "other"] as const;

export const USIU_ADDRESS = {
  name: "United States International University Africa",
  street: "USIU Road, Off Thika Road",
  poBox: "P.O. Box 14634, 00800",
  city: "Nairobi, Kenya",
  phone: "+254 730 116 000",
  email: "admissions@usiu.ac.ke",
};
