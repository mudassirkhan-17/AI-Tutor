-- Optional sample questions to populate the app before your CSV arrives.
-- Run after 0001_init.sql. Safe to re-run (upserts by id not used; just insert).

insert into public.questions (section_code, level, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation) values
-- A1
('A1', 'easy', 'Which of the following is an example of real property?',
  'A refrigerator rented with an apartment', 'A chandelier bolted to the ceiling', 'An outdoor table set', 'A television',
  'B', 'Think about attachment to the land or structure.', 'A chandelier bolted to the ceiling is a fixture and is considered real property.'),
('A1', 'medium', 'The bundle of legal rights conveyed with real property does NOT include:',
  'Right of possession', 'Right of enjoyment', 'Right to violate zoning', 'Right of disposition',
  'C', 'Rights never override public law.', 'The bundle of rights does not allow owners to violate zoning or public regulations.'),
-- A2
('A2', 'medium', 'Zoning ordinances are enacted through:',
  'Federal law', 'The local government''s police power', 'HUD guidelines', 'Deed covenants',
  'B', 'Local governments regulate land use under this power.', 'Zoning is an exercise of local police power for public welfare.'),
-- A3
('A3', 'medium', 'Which approach to value is most reliable for a single-family home?',
  'Cost approach', 'Income approach', 'Sales comparison approach', 'Gross rent multiplier',
  'C', 'Homes trade actively in the market.', 'Sales comparison is considered most reliable for residential property.'),
-- A4
('A4', 'hard', 'In a fully amortized loan, each monthly payment:',
  'Pays only interest', 'Pays only principal', 'Is applied to interest first, then principal', 'Varies randomly',
  'C', 'Amortization schedules allocate payments in a consistent order.', 'Each payment is split between interest and principal, with interest calculated first.'),
-- A5
('A5', 'easy', 'A fiduciary duty of confidentiality continues:',
  'Only while the listing is active', 'For 30 days after closing', 'Forever, even after the agency ends', 'Only if in writing',
  'C', 'Some duties survive the agency relationship.', 'Confidentiality is an ongoing duty that survives termination of the agency.'),
-- A6
('A6', 'medium', 'Under federal law, a seller of a pre-1978 home must disclose:',
  'Any lead-based paint hazards known', 'The exact year of construction', 'The original purchase price', 'Future market forecasts',
  'A', 'Think health hazards and older homes.', 'The federal Lead-Based Paint Disclosure Rule requires disclosure of known hazards in pre-1978 homes.'),
-- B1
('B1', 'medium', 'In South Carolina, a real estate license is issued by:',
  'The Attorney General', 'The SC Real Estate Commission', 'NAR', 'The local MLS',
  'B', 'The regulator is a state commission.', 'The SC Real Estate Commission issues and regulates real estate licenses in SC.'),
-- B2
('B2', 'medium', 'In SC, a Designated Agent is assigned by:',
  'The buyer', 'The seller', 'The broker-in-charge', 'The MLS',
  'C', 'Think firm-level assignment.', 'The broker-in-charge designates agents within a firm to exclusively represent a client.'),
-- B3
('B3', 'easy', 'A valid contract in SC requires all EXCEPT:',
  'Offer and acceptance', 'Legally competent parties', 'Consideration', 'Notarization',
  'D', 'Notarization isn''t always needed.', 'Notarization is not required for a contract to be valid; it''s required for recording deeds.'),
-- B4
('B4', 'medium', 'In SC, security deposits for residential leases must be:',
  'Kept by the landlord personally', 'Held in trust or escrow', 'Invested in securities', 'Returned within 24 hours',
  'B', 'Trust funds require separation.', 'Security deposits must be held in a separate trust/escrow account.'),
-- B5
('B5', 'easy', 'The federal Fair Housing Act protects against discrimination based on all EXCEPT:',
  'Race', 'Color', 'Marital status', 'Religion',
  'C', 'Federal protected classes are specific.', 'Marital status is NOT a federally protected class (though some states add it).'),
-- B6
('B6', 'medium', 'At closing in SC, escrowed funds are typically released by:',
  'The listing agent', 'The closing attorney', 'The buyer', 'The MLS',
  'B', 'SC closings are attorney-driven.', 'In SC, real estate closings are conducted by attorneys who release escrowed funds per the settlement statement.');
