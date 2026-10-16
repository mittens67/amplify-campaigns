import type { Category, ChannelKey, CreatorType } from '@amplify/domain';

export type SeedPlan =
  | { kind: 'draft'; step: 'basics' | 'story' | 'visuals' | 'reach' | 'submit'; ageDays: number }
  | { kind: 'submitted'; submittedDaysAgo: number }
  | { kind: 'changes'; submittedDaysAgo: number; message: string; notes: Record<string, string> }
  | { kind: 'funding'; approvedDaysAgo: number; pct: number }
  | { kind: 'prep'; approvedDaysAgo: number; fundedDaysAgo: number }
  | { kind: 'promoting'; approvedDaysAgo: number; fundedDaysAgo: number; launchedDaysAgo: number }
  | { kind: 'completed'; approvedDaysAgo: number; fundedDaysAgo: number; launchedDaysAgo: number }
  | { kind: 'failed'; approvedDaysAgo: number; raisedCents: number };

export interface SeedSpec {
  key: string;
  owner: 'maya' | 'org';
  orgEmail?: string;
  img: string;
  featured?: boolean;
  category: Category;
  creatorName: string;
  creatorType: CreatorType;
  title: string;
  summary: string;
  headline: string;
  intro: string;
  sections: { heading?: string; text: string; cite?: number[] }[];
  stat?: { value: string; text: string; cite?: number[] };
  quote?: { text: string; attribution: string };
  sources: { title: string; url: string; publisher: string }[];
  actions: string[];
  ad: { headline: string; description: string; cta: string };
  reach: {
    locations: string[];
    interests: string[];
    channels: ChannelKey[];
    split: Partial<Record<ChannelKey, number>>;
    durationDays: number;
    ageMin?: number;
    ageMax?: number;
  };
  goal: number; // dollars
  plan: SeedPlan;
  /** Contribution from the demo backer (Sam), in dollars. */
  samBacks?: number;
}

export const SEED: SeedSpec[] = [
  {
    key: 'river',
    owner: 'org',
    orgEmail: 'anacostia@demo.amplify',
    img: 'river',
    featured: true,
    category: 'Environment',
    creatorName: 'Anacostia Riverkeepers Collective',
    creatorType: 'nonprofit',
    title: 'Clean water starts upstream: join a river cleanup',
    summary: 'Most river trash starts as street litter miles away. One Saturday a month, neighbours can stop it before it reaches the water.',
    headline: 'Most of the trash in our river never started there.',
    intro:
      'Plastic bottles, bags and food wrappers wash off streets and down storm drains every time it rains. By the time they reach the Anacostia, they are much harder to remove. Monthly neighbourhood cleanups catch it upstream — and they need more hands.',
    sections: [
      {
        heading: 'Where the trash comes from',
        text: 'Stormwater carries litter from sidewalks and parking lots straight into local streams. Cleanup crews consistently find that the majority of what they pull out is single-use packaging from nearby streets, not items dumped at the riverbank.',
        cite: [1],
      },
      {
        heading: 'Why monthly cleanups work',
        text: 'Regular volunteer cleanups remove debris before it breaks down into microplastics, and they give neighbours a reason to notice their own blocks. Trash traps installed after community pressure have removed tonnes of litter from the watershed.',
        cite: [2],
      },
    ],
    stat: { value: '80%', text: 'of ocean plastic is estimated to come from land-based sources like streets and storm drains', cite: [3] },
    quote: { text: 'The river is downhill from all of us. Cleaning it up starts on our own street.', attribution: 'Volunteer coordinator' },
    sources: [
      { title: 'Soak Up the Rain: Stormwater Basics', url: 'https://www.epa.gov/soakuptherain/soak-rain-stormwater-basics', publisher: 'US EPA' },
      { title: 'Anacostia River Trash TMDL', url: 'https://doee.dc.gov/service/anacostia-river-trash-tmdl', publisher: 'DC Department of Energy & Environment' },
      { title: 'Ocean Plastic Pollution', url: 'https://oceanservice.noaa.gov/hazards/marinedebris/', publisher: 'NOAA' },
    ],
    actions: ['Join a cleanup on the second Saturday of the month', 'Bin litter before it reaches a storm drain', 'Share the cleanup calendar with a neighbour'],
    ad: { headline: 'Stop river trash at the street', description: 'One Saturday a month, neighbours catch litter before it reaches the Anacostia. Join a cleanup near you.', cta: 'Find a cleanup' },
    reach: { locations: ['Washington, DC', 'Prince George’s County, MD'], interests: ['Outdoors', 'Volunteering', 'Local news'], channels: ['meta', 'news'], split: { meta: 70, news: 30 }, durationDays: 21 },
    goal: 10000,
    plan: { kind: 'funding', approvedDaysAgo: 8, pct: 41 },
    samBacks: 25,
  },
  {
    key: 'heat',
    owner: 'maya',
    img: 'heat',
    featured: true,
    category: 'Health',
    creatorName: 'Maya Okafor',
    creatorType: 'individual',
    title: 'Water, rest, shade: heat safety for outdoor workers',
    summary: 'Record heat is putting outdoor workers at risk. Simple breaks for water, rest and shade prevent heat illness — if people know the signs.',
    headline: 'The heat is rising. Knowing the signs saves lives.',
    intro:
      'Delivery riders, farm workers and construction crews are working through record temperatures. Heat illness is preventable, but only if workers and employers recognise it early and treat breaks as part of the job.',
    sections: [
      {
        heading: 'Why this matters now',
        text: 'Heat is the leading weather-related cause of death in the United States. Many outdoor workers feel they can’t stop to rest, so early symptoms like dizziness and confusion get pushed through until it is too late.',
        cite: [1],
      },
      {
        heading: 'What works',
        text: 'Public-health agencies agree on a simple rule: water, rest and shade. Letting new workers acclimatise over their first week and planning breaks on hot days dramatically reduces heat illness.',
        cite: [2],
      },
    ],
    stat: { value: '600+', text: 'heat-related deaths recorded in Maricopa County, Arizona in 2023', cite: [3] },
    sources: [
      { title: 'Heat and Health', url: 'https://www.cdc.gov/heat-health/', publisher: 'CDC' },
      { title: 'Heat: Water. Rest. Shade.', url: 'https://www.osha.gov/heat', publisher: 'OSHA' },
      { title: 'Heat Deaths Report 2023', url: 'https://www.maricopa.gov/1858/Heat-Surveillance', publisher: 'Maricopa County Public Health' },
    ],
    actions: ['Learn the warning signs of heat stroke', 'Take water, rest and shade breaks', 'Ask your employer for a heat plan'],
    ad: { headline: 'Heat illness is preventable', description: 'Know the warning signs and take water, rest and shade breaks on hot days. Share it with someone who works outside.', cta: 'Learn the signs' },
    reach: { locations: ['Arizona', 'Texas'], interests: ['Construction', 'Agriculture', 'Delivery work'], channels: ['meta', 'youtube'], split: { meta: 60, youtube: 40 }, durationDays: 21 },
    goal: 5000,
    plan: { kind: 'promoting', approvedDaysAgo: 30, fundedDaysAgo: 12, launchedDaysAgo: 8 },
    samBacks: 10,
  },
  {
    key: 'library',
    owner: 'org',
    orgEmail: 'eastside@demo.amplify',
    img: 'library',
    featured: true,
    category: 'Education',
    creatorName: 'Eastside Reading Alliance',
    creatorType: 'community',
    title: 'Every kid deserves a library card',
    summary: 'A free library card opens books, homework help and summer programs. Thousands of local kids still don’t have one.',
    headline: 'The most valuable card in your wallet is free.',
    intro:
      'Public libraries offer far more than books: free homework help, internet access, summer reading programs and a safe place after school. But many families don’t know their children can sign up for free, with no fines on kids’ cards.',
    sections: [
      {
        heading: 'What a card unlocks',
        text: 'Children who read over the summer hold on to what they learned during the school year. Library summer programs are free and open to every child with a card.',
        cite: [1],
      },
      { heading: 'Fine-free for kids', text: 'Many library systems have eliminated late fines on children’s cards, removing one of the most common reasons families stopped visiting.', cite: [2] },
    ],
    sources: [
      { title: 'Summer Reading Research', url: 'https://www.ala.org/advocacy/summer-reading', publisher: 'American Library Association' },
      { title: 'Fine-Free Libraries Map', url: 'https://www.urbanlibraries.org/initiatives/fine-free-map', publisher: 'Urban Libraries Council' },
    ],
    actions: ['Sign your child up for a free card', 'Visit a summer reading event', 'Tell another parent'],
    ad: { headline: 'Free library cards for every kid', description: 'Books, homework help and summer programs — all free with a library card. No fines on kids’ cards.', cta: 'Get a card' },
    reach: { locations: ['Columbus, OH'], interests: ['Parenting', 'Education', 'Reading'], channels: ['meta', 'search'], split: { meta: 75, search: 25 }, durationDays: 14, ageMin: 25, ageMax: 54 },
    goal: 8000,
    plan: { kind: 'funding', approvedDaysAgo: 20, pct: 72 },
    samBacks: 10,
  },
  {
    key: 'vaccine',
    owner: 'org',
    orgEmail: 'northside@demo.amplify',
    img: 'vaccine',
    category: 'Health',
    creatorName: 'Northside Health Collaborative',
    creatorType: 'nonprofit',
    title: 'Free walk-in flu shots at neighbourhood clinics',
    summary: 'Weekend pop-up clinics offer free flu shots with no appointment and no insurance needed. Most people nearby haven’t heard of them.',
    headline: 'A flu shot shouldn’t take a day off work.',
    intro:
      'Our pop-up clinics run on Saturdays at community centres and corner stores, with no appointment or insurance needed. Turnout is lowest in the neighbourhoods with the highest flu hospitalisation rates — mostly because people don’t know the clinics exist.',
    sections: [
      { heading: 'Why it matters', text: 'Annual flu vaccination reduces the risk of flu illness and hospitalisation, especially for older adults and people with chronic conditions.', cite: [1] },
      { heading: 'Who we want to reach', text: 'Adults in Northside zip codes, especially shift workers and caregivers who can’t make weekday appointments.' },
    ],
    sources: [{ title: 'Key Facts About Seasonal Flu Vaccine', url: 'https://www.cdc.gov/flu/vaccines/keyfacts.html', publisher: 'CDC' }],
    actions: ['Find a Saturday clinic near you', 'Bring a family member', 'Share the clinic schedule'],
    ad: { headline: 'Free flu shots this Saturday', description: 'Walk in — no appointment or insurance needed. Pop-up clinics at community centres across Northside.', cta: 'See clinic times' },
    reach: { locations: ['Minneapolis, MN'], interests: ['Health & wellness', 'Family'], channels: ['meta', 'news'], split: { meta: 80, news: 20 }, durationDays: 14 },
    goal: 12000,
    plan: { kind: 'funding', approvedDaysAgo: 4, pct: 18 },
  },
  {
    key: 'transit',
    owner: 'org',
    orgEmail: 'riders@demo.amplify',
    img: 'transit',
    category: 'Public Policy',
    creatorName: 'Riders for Better Transit',
    creatorType: 'community',
    title: 'What a 10-minute bus would change for our town',
    summary: 'Buses that come every 10 minutes get used. We’re explaining the trade-offs before the council votes on the new network.',
    headline: 'Frequency is freedom.',
    intro:
      'When a bus comes every 10 minutes, you stop checking the timetable and just go. The city council will vote this spring on a redesigned bus network that trades some coverage for much higher frequency on main corridors. Here is what that means for riders.',
    sections: [
      { heading: 'The trade-off', text: 'A fixed budget can run many routes infrequently or fewer routes frequently. Cities that redesigned networks around frequency have generally seen ridership grow.', cite: [1] },
      { heading: 'What isn’t changing', text: 'Paratransit and on-demand services would continue in areas that lose fixed routes. We think residents deserve to hear both sides before the vote.' },
    ],
    sources: [{ title: 'Houston’s Bus Network Redesign Results', url: 'https://www.ridemetro.org/about/reimagining-metro', publisher: 'Houston METRO' }],
    actions: ['Read the draft network map', 'Comment at the public hearing', 'Share with a regular rider'],
    ad: { headline: 'A bus every 10 minutes?', description: 'The council votes on a new bus network this spring. Learn what changes, what doesn’t, and how to have your say.', cta: 'See the map' },
    reach: { locations: ['Tulsa, OK'], interests: ['Local politics', 'Commuting'], channels: ['meta', 'news', 'search'], split: { meta: 50, news: 30, search: 20 }, durationDays: 14 },
    goal: 6000,
    plan: { kind: 'prep', approvedDaysAgo: 22, fundedDaysAgo: 2 },
  },
  {
    key: 'housing',
    owner: 'org',
    orgEmail: 'opendoors@demo.amplify',
    img: 'housing',
    category: 'Economic Policy',
    creatorName: 'Open Doors Housing Coalition',
    creatorType: 'organization',
    title: 'Rent is eating the paycheck: the case for more homes',
    summary: 'Half of local renters spend over 30% of income on rent. Here’s what more homes near transit could do, and what it would cost.',
    headline: 'When homes are scarce, everyone pays more.',
    intro:
      'Rents have risen faster than wages for a decade. Most economists agree the main driver is a shortage of homes where jobs are. A zoning reform before the city would allow small apartment buildings near transit stops.',
    sections: [
      { heading: 'What the data shows', text: 'Cost-burdened renter households — paying more than 30% of income on housing — have reached record numbers nationally.', cite: [1] },
      { heading: 'What the reform would and wouldn’t do', text: 'It would allow up to four-storey buildings within a short walk of frequent transit. It would not remove existing protections for historic districts. Critics worry about parking; we include their concerns in our FAQ.' },
    ],
    stat: { value: '22.4M', text: 'US renter households were cost-burdened in 2022', cite: [1] },
    sources: [{ title: 'America’s Rental Housing 2024', url: 'https://www.jchs.harvard.edu/americas-rental-housing-2024', publisher: 'Harvard Joint Center for Housing Studies' }],
    actions: ['Read the zoning proposal', 'Tell your council member what you think'],
    ad: { headline: 'Why rent keeps rising', description: 'A shortage of homes near jobs is driving rents up. See what the zoning proposal would change — and what it wouldn’t.', cta: 'Read the facts' },
    reach: { locations: ['Denver, CO'], interests: ['Real estate', 'Local politics', 'Personal finance'], channels: ['meta', 'youtube', 'news'], split: { meta: 50, youtube: 25, news: 25 }, durationDays: 30 },
    goal: 15000,
    plan: { kind: 'funding', approvedDaysAgo: 10, pct: 55 },
  },
  {
    key: 'bees',
    owner: 'org',
    orgEmail: 'lena@demo.amplify',
    img: 'bees',
    category: 'Science',
    creatorName: 'Dr. Lena Brooks',
    creatorType: 'influencer',
    title: 'Plant one native flower for the bees',
    summary: 'Native bees are declining, and gardens can help. One native plant per yard adds up to a corridor across the city.',
    headline: 'Your yard can be a bee’s rest stop.',
    intro: 'Hundreds of native bee species live in our region, and many are in decline from habitat loss. Research shows that even small patches of native flowers in yards and balconies support pollinators.',
    sections: [{ heading: 'Small patches, big effect', text: 'Urban gardens with native plants host more pollinator species than lawns. Planting in clusters makes flowers easier for bees to find.', cite: [1] }],
    sources: [{ title: 'Pollinator-Friendly Plants', url: 'https://www.fs.usda.gov/managing-land/wildflowers/pollinators', publisher: 'US Forest Service' }],
    actions: ['Plant one native flower this season', 'Skip pesticides on flowering plants'],
    ad: { headline: 'One flower helps a bee', description: 'Native bees are declining. Plant one native flower in your yard or balcony to help build a city-wide corridor.', cta: 'Pick a plant' },
    reach: { locations: ['Portland, OR'], interests: ['Gardening', 'Nature'], channels: ['meta', 'youtube'], split: { meta: 50, youtube: 50 }, durationDays: 14 },
    goal: 3000,
    plan: { kind: 'completed', approvedDaysAgo: 60, fundedDaysAgo: 44, launchedDaysAgo: 40 },
    samBacks: 50,
  },
  {
    key: 'mural',
    owner: 'org',
    orgEmail: 'southside@demo.amplify',
    img: 'mural',
    category: 'Arts & Culture',
    creatorName: 'Southside Arts Council',
    creatorType: 'community',
    title: 'Paint the underpass: a mural by and for the neighbourhood',
    summary: 'We want every household to help choose the design for the 4th Street underpass mural. Voting is open for three weeks.',
    headline: 'A grey wall, a neighbourhood’s story.',
    intro: 'The 4th Street underpass is the gateway to Southside. Local artists have submitted three designs, and we want every resident — not just the usual voices — to help choose.',
    sections: [{ text: 'Public art projects that involve residents in design tend to see less vandalism and more lasting pride. Voting is online and at the library.', cite: [1] }],
    sources: [{ title: 'Creative Placemaking', url: 'https://www.arts.gov/impact/creative-placemaking', publisher: 'National Endowment for the Arts' }],
    actions: ['Vote for a mural design', 'Join a community paint day'],
    ad: { headline: 'Choose our next mural', description: 'Three local artists, one underpass. Vote for the design that tells Southside’s story.', cta: 'Vote now' },
    reach: { locations: ['Pittsburgh, PA'], interests: ['Art', 'Local events'], channels: ['meta'], split: { meta: 100 }, durationDays: 14 },
    goal: 4000,
    plan: { kind: 'funding', approvedDaysAgo: 6, pct: 33 },
  },
  {
    key: 'farm',
    owner: 'org',
    orgEmail: 'market@demo.amplify',
    img: 'farm',
    category: 'Business',
    creatorName: 'Riverside Farmers Market',
    creatorType: 'business',
    title: 'Winter market is open: buying local keeps farms going',
    summary: 'Our indoor winter market keeps 40 small farms earning through the off-season. Many shoppers think the market closes in October.',
    headline: 'The market didn’t close. It moved inside.',
    intro: 'Every winter, sales at our market drop by half because shoppers assume we close after harvest. The indoor winter market runs every Saturday through March, with produce, eggs, bread and preserves from 40 local farms.',
    sections: [{ text: 'Money spent at farmers markets circulates more in the local economy than the same spending at chain stores.', cite: [1] }],
    sources: [{ title: 'Local Food Economies', url: 'https://www.ers.usda.gov/topics/food-markets-prices/local-foods/', publisher: 'USDA Economic Research Service' }],
    actions: ['Visit the winter market on Saturday', 'Bring a friend'],
    ad: { headline: 'The farmers market is open', description: 'Every Saturday through March, indoors. Produce, eggs and bread from 40 local farms.', cta: 'Plan a visit' },
    reach: { locations: ['Madison, WI'], interests: ['Food', 'Cooking', 'Local business'], channels: ['meta', 'search'], split: { meta: 70, search: 30 }, durationDays: 21 },
    goal: 2500,
    plan: { kind: 'promoting', approvedDaysAgo: 26, fundedDaysAgo: 9, launchedDaysAgo: 5 },
  },
  {
    key: 'voting',
    owner: 'org',
    orgEmail: 'civic@demo.amplify',
    img: 'voting',
    category: 'Public Policy',
    creatorName: 'Civic Info Project',
    creatorType: 'nonprofit',
    title: 'Your polling place may have moved — check before you go',
    summary: 'Redistricting moved one in five polling places in the county. A 30-second check avoids a wasted trip on election day.',
    headline: 'Same address, new polling place.',
    intro: 'After redistricting, about one in five polling locations in the county changed. This is a non-partisan reminder: check your polling place before election day.',
    sections: [{ text: 'You can look up your polling place on the official county elections site. Bring an accepted form of ID if your state requires it.', cite: [1] }],
    sources: [{ title: 'Find your polling place', url: 'https://www.vote.org/polling-place-locator/', publisher: 'Vote.org' }],
    actions: ['Check your polling place', 'Make a plan to vote'],
    ad: { headline: 'Check your polling place', description: 'One in five polling places moved this year. A 30-second check saves a wasted trip.', cta: 'Check now' },
    reach: { locations: ['Fulton County, GA'], interests: ['News', 'Community'], channels: ['meta', 'search', 'youtube'], split: { meta: 40, search: 40, youtube: 20 }, durationDays: 10, ageMin: 18 },
    goal: 7500,
    plan: { kind: 'completed', approvedDaysAgo: 50, fundedDaysAgo: 34, launchedDaysAgo: 30 },
  },
  {
    key: 'ocean',
    owner: 'org',
    orgEmail: 'coast@demo.amplify',
    img: 'ocean',
    featured: true,
    category: 'Environment',
    creatorName: 'Coastline Keepers',
    creatorType: 'nonprofit',
    title: 'Leave only footprints: beach litter is preventable',
    summary: 'Most beach litter is left by visitors, not washed ashore. A simple pack-it-out habit keeps our beaches clean all summer.',
    headline: 'The tide doesn’t take it away.',
    intro: 'Volunteers remove hundreds of kilograms of litter from our beaches every summer weekend. Most of it — bottle caps, food wrappers, cigarette butts — was left by visitors, and much of it ends up in the ocean.',
    sections: [{ text: 'Cigarette butts are the most common item collected in beach cleanups worldwide.', cite: [1] }],
    stat: { value: '#1', text: 'Cigarette butts are the most collected item on beaches worldwide', cite: [1] },
    sources: [{ title: 'International Coastal Cleanup Report', url: 'https://oceanconservancy.org/trash-free-seas/international-coastal-cleanup/annual-data-release/', publisher: 'Ocean Conservancy' }],
    actions: ['Pack out everything you bring', 'Use the beach ashtrays'],
    ad: { headline: 'Leave only footprints', description: 'Most beach litter is left by visitors. Pack it out and keep our beaches clean all summer.', cta: 'Take the pledge' },
    reach: { locations: ['San Diego, CA'], interests: ['Beach', 'Surfing', 'Travel'], channels: ['meta', 'youtube'], split: { meta: 60, youtube: 40 }, durationDays: 21 },
    goal: 5000,
    plan: { kind: 'funding', approvedDaysAgo: 15, pct: 88 },
  },
  {
    key: 'wildfire',
    owner: 'org',
    orgEmail: 'cleanair@demo.amplify',
    img: 'wildfire',
    category: 'Health',
    creatorName: 'Clean Air Neighbors',
    creatorType: 'community',
    title: 'Wildfire smoke is a health risk — here’s how to prepare',
    summary: 'Smoke days are becoming more common. A box fan and a filter make a cheap, effective air cleaner for your home.',
    headline: 'You can’t always see the risk.',
    intro: 'Wildfire smoke can travel hundreds of miles and affect people far from any fire. Fine particles in smoke are linked to asthma attacks and heart problems. Preparing before smoke season is simple and cheap.',
    sections: [{ heading: 'A $50 air cleaner', text: 'A box fan with a MERV-13 filter attached can substantially reduce indoor particle levels in a single room.', cite: [1] }],
    sources: [{ title: 'Wildfire Smoke and Your Health', url: 'https://www.airnow.gov/wildfires/', publisher: 'AirNow (EPA)' }],
    actions: ['Check the air quality index on smoke days', 'Make a DIY air cleaner'],
    ad: { headline: 'Get ready for smoke season', description: 'Wildfire smoke affects people far from the fire. A box fan and filter can clean the air in a room.', cta: 'See how' },
    reach: { locations: ['Sacramento, CA'], interests: ['Health', 'Home improvement'], channels: ['meta', 'news'], split: { meta: 60, news: 40 }, durationDays: 21 },
    goal: 6000,
    plan: { kind: 'funding', approvedDaysAgo: 1, pct: 9 },
  },
  {
    key: 'solar',
    owner: 'org',
    orgEmail: 'sunshare@demo.amplify',
    img: 'solar',
    category: 'Environment',
    creatorName: 'Sunshare Co-op',
    creatorType: 'business',
    title: 'Rooftop solar pays back faster than you think',
    summary: 'Tax credits cut the cost of rooftop solar by 30%. We explain the numbers for an average home.',
    headline: 'The math changed.',
    intro: 'Rooftop solar costs have fallen sharply over the last decade, and federal tax credits reduce installation costs further.',
    sections: [{ text: 'Payback periods depend on your electricity rates, roof orientation and local incentives.', cite: [1] }],
    sources: [{ title: 'Homeowner’s Guide to Going Solar', url: 'https://www.energy.gov/eere/solar/homeowners-guide-going-solar', publisher: 'US Department of Energy' }],
    actions: ['Get a free roof assessment'],
    ad: { headline: 'Solar costs less than you think', description: 'Tax credits cut the cost of rooftop solar by 30%. See the numbers for an average home.', cta: 'See the math' },
    reach: { locations: ['Phoenix, AZ'], interests: ['Home ownership', 'Energy'], channels: ['search'], split: { search: 100 }, durationDays: 14 },
    goal: 4000,
    plan: { kind: 'failed', approvedDaysAgo: 25, raisedCents: 9000 },
    samBacks: 15,
  },
  // Submitted — waiting in the reviewer queue
  {
    key: 'science',
    owner: 'org',
    orgEmail: 'stemfair@demo.amplify',
    img: 'science',
    category: 'Science',
    creatorName: 'Young Scientists Network',
    creatorType: 'nonprofit',
    title: 'Science fairs build scientists — volunteer as a judge',
    summary: 'Regional science fairs need 200 volunteer judges each spring. No PhD needed — just curiosity and a free Saturday.',
    headline: 'Your questions could change a student’s path.',
    intro: 'Every spring, thousands of students present projects at regional science fairs. Each needs volunteer judges to ask questions and give feedback, and fairs are short of judges every year.',
    sections: [{ text: 'Students who receive feedback from working professionals report higher interest in STEM careers.', cite: [1] }],
    sources: [{ title: 'Science Fair Judging', url: 'https://www.societyforscience.org/isef/', publisher: 'Society for Science' }],
    actions: ['Sign up to judge for one Saturday'],
    ad: { headline: 'Be a science fair judge', description: 'Regional fairs need 200 volunteer judges. No PhD needed — just curiosity and a free Saturday.', cta: 'Volunteer' },
    reach: { locations: ['Raleigh, NC'], interests: ['Science', 'Volunteering'], channels: ['meta'], split: { meta: 100 }, durationDays: 14 },
    goal: 3500,
    plan: { kind: 'submitted', submittedDaysAgo: 1 },
  },
  {
    key: 'bakery',
    owner: 'org',
    orgEmail: 'bakers@demo.amplify',
    img: 'smallbiz',
    category: 'Business',
    creatorName: 'Main Street Bakers Guild',
    creatorType: 'business',
    title: 'The best bread in town is around the corner',
    summary: 'Independent bakeries are closing as costs rise. A weekly loaf from a local baker keeps them open.',
    headline: 'Small ovens, big hearts.',
    intro: 'Independent bakeries on Main Street have faced rising flour and energy costs. We want neighbours to know they exist — and that a weekly loaf makes a difference.',
    sections: [{ text: 'Small businesses employ nearly half of private-sector workers in the US.', cite: [1] }],
    sources: [{ title: 'Small Business FAQ', url: 'https://advocacy.sba.gov/resources/research-and-data/', publisher: 'US Small Business Administration' }],
    actions: ['Buy a loaf from a local bakery this week'],
    ad: { headline: 'Bread from your neighbours', description: 'Independent bakeries are closing as costs rise. A weekly loaf keeps them baking.', cta: 'Find a bakery' },
    reach: { locations: ['Burlington, VT'], interests: ['Food', 'Local business'], channels: ['meta'], split: { meta: 100 }, durationDays: 14 },
    goal: 2000,
    plan: { kind: 'submitted', submittedDaysAgo: 2 },
  },
  // Maya's campaign with changes requested
  {
    key: 'teens',
    owner: 'maya',
    img: 'mental',
    category: 'Health',
    creatorName: 'Maya Okafor',
    creatorType: 'individual',
    title: 'Talking helps: a mental health check-in for teens',
    summary: 'One in five teens experiences a mental health condition. A simple check-in can open the conversation.',
    headline: 'Ask twice.',
    intro: 'Teens often say “I’m fine” the first time. Asking a second time, and meaning it, can open a real conversation.',
    sections: [{ text: 'Free, confidential support is available 24/7 by calling or texting 988.', cite: [1] }],
    sources: [{ title: '988 Suicide & Crisis Lifeline', url: 'https://988lifeline.org/', publisher: 'SAMHSA' }],
    actions: ['Check in with a teen you know', 'Save 988 in your phone'],
    ad: { headline: 'Ask twice', description: 'Teens often say “I’m fine” the first time. Ask again, and mean it.', cta: 'Learn how' },
    reach: { locations: ['Chicago, IL'], interests: ['Parenting', 'Mental health'], channels: ['meta', 'youtube'], split: { meta: 50, youtube: 50 }, durationDays: 21, ageMin: 30, ageMax: 60 },
    goal: 4500,
    plan: {
      kind: 'changes',
      submittedDaysAgo: 3,
      message:
        'Thanks — this is a thoughtful campaign. Before we approve it, please add a source for the “one in five teens” statistic and add a second source on how to start the conversation.',
      notes: {
        'basics.summary': 'The “one in five” statistic needs a cited source in your story.',
        'story.sources': 'Add a source for the prevalence statistic (e.g. NIMH or CDC) and one for conversation guidance.',
      },
    },
  },
  // Maya's in-progress draft
  {
    key: 'teacher',
    owner: 'maya',
    img: 'teacher',
    category: 'Education',
    creatorName: 'Maya Okafor',
    creatorType: 'individual',
    title: 'Teachers spend $500 of their own money on supplies',
    summary: 'Most teachers buy classroom supplies themselves. Let’s talk about what schools should provide.',
    headline: '',
    intro: 'Nearly every public school teacher spends their own money on classroom supplies.',
    sections: [],
    sources: [],
    actions: [],
    ad: { headline: '', description: '', cta: 'Learn more' },
    reach: { locations: [], interests: [], channels: [], split: {}, durationDays: 21 },
    goal: 0,
    plan: { kind: 'draft', step: 'story', ageDays: 1 },
  },
];

export const BACKER_NAMES = [
  'Jordan P.', 'Alex K.', 'Priya S.', 'Chris M.', 'Taylor R.', 'Morgan L.', 'Jamie W.', 'Sofia G.', 'Ben A.', 'Ava T.',
  'Noah H.', 'Leah D.', 'Omar F.', 'Grace Y.', 'Ethan C.', 'Mia V.', 'Lucas B.', 'Zoe N.', 'Ivan O.', 'Hana I.',
];
