// All event copy lives here. Copy this file (and src/track.ts) to reskin the site for a new event.
//
// SAMPLE CONTENT: every name, date, place, number, team and price below is invented for the demo.
// "Apex Rush" is a placeholder; nothing here refers to a real series, team, driver, sponsor,
// circuit or brand. Replace it all before using the site for a real event.

export const SAMPLE_NOTE = 'Sample content: all names, dates, places and prices are invented.';

export interface ChapterBase {
  /** Anchor id and nav key. */
  id: string;
  /** Short label for the side navigation. */
  nav: string;
  /** Scroll length in viewport heights. Longer chapters give the camera more room. */
  weight: number;
  /** Small label above the heading, e.g. "01 / Start". */
  kicker: string;
  heading: string;
}

export interface Fact {
  value: string;
  unit: string;
  label: string;
}

export interface ScheduleBlock {
  name: string;
  day: string;
  time: string;
  note: string;
}

export interface Team {
  name: string;
  tagline: string;
  /** Livery colour applied to a kit car in code. */
  colour: string;
  /** Which kit car body to use. */
  car: 'raceCarRed' | 'raceCarOrange' | 'raceCarGreen' | 'raceCarWhite';
  number: string;
}

export interface TicketTier {
  name: string;
  priceInr: number;
  perks: string[];
}

export const content = {
  meta: {
    siteName: 'Apex Rush 2027',
    title: 'Apex Rush 2027: a scroll-story race weekend (sample site)',
    description:
      'A scroll-driven 3D landing page for the fictional Apex Rush 2027 race weekend. Sample content built with three.js and CC0 Kenney models.',
    ogImage: '/og.jpg',
    themeColour: '#0b0b0d',
    lang: 'en',
  },

  brand: {
    name: 'Apex Rush',
    year: '2027',
    colours: {
      asphalt: '#0b0b0d',
      panel: '#141418',
      line: '#2b2b33',
      accent: '#ff5a1f',
      text: '#ffffff',
      muted: '#b7b7c2',
    },
  },

  event: {
    startsAt: '2027-03-19T09:00:00+05:30',
    dates: '19–21 March 2027',
    place: 'Vesper Fields Circuit, Northgate',
    tagline: 'Three days. One lap that never lets go.',
  },

  chapters: {
    hero: {
      id: 'hero',
      nav: 'Start',
      weight: 1.3,
      kicker: '01 / The grid',
      heading: 'Apex Rush 2027',
      cue: 'Scroll to start the engine',
      startUp: ['Ignition', 'Fuel pump', 'Lights'],
    },
    track: {
      id: 'track',
      nav: 'Track',
      weight: 1.7,
      kicker: '02 / The track',
      heading: 'One lap. Four corners. No room to breathe.',
      body: 'From above it looks simple. At ground level it is a clockwise loop of tight braking, a flat-out straight and a double bend that decides the race.',
      facts: [
        { value: '4.2', unit: 'km', label: 'Lap length' },
        { value: '4', unit: '', label: 'Corners' },
        { value: '18', unit: 'm', label: 'Elevation change' },
      ] satisfies Fact[],
    },
    corner1: {
      id: 'corner1',
      nav: 'Corner 1',
      weight: 1.5,
      kicker: '03 / Turn one',
      heading: 'The first corner decides everything.',
      body: 'A tight right-hander straight after the start line. Brake late, hold the line, and the whole field is behind you. Get it wrong and you spend the afternoon looking at mirrors.',
    },
    straight: {
      id: 'straight',
      nav: 'Straight',
      weight: 1.7,
      kicker: '04 / The straight',
      heading: 'Four tiles of pure speed.',
      body: 'The back straight is the longest stretch of the lap. Slipstreams, late moves and one very quiet countdown to lights out.',
      countdownLabel: 'Lights out in',
      countdownDone: 'Lights out. Race weekend is live.',
    },
    schedule: {
      id: 'schedule',
      nav: 'Schedule',
      weight: 2.3,
      kicker: '05 / Corners two and three',
      heading: 'The double bend. Three days to master it.',
      blocks: [
        {
          name: 'Practice',
          day: 'Friday',
          time: '09:00 – 17:00',
          note: 'Two open sessions to learn the track.',
        },
        {
          name: 'Qualifying',
          day: 'Saturday',
          time: '11:00 – 15:00',
          note: 'One flying lap decides the grid.',
        },
        {
          name: 'Race',
          day: 'Sunday',
          time: '14:00',
          note: 'Forty laps, lights out to flag.',
        },
      ] satisfies ScheduleBlock[],
    },
    teams: {
      id: 'teams',
      nav: 'Teams',
      weight: 1.9,
      kicker: '06 / The teams',
      heading: 'Four teams. One grid.',
      body: 'Invented teams for the demo. Each car is a CC0 kit model recoloured in code.',
      teams: [
        {
          name: 'Ember Works',
          tagline: 'Loud, quick and a little reckless.',
          colour: '#ff5a1f',
          car: 'raceCarOrange',
          number: '07',
        },
        {
          name: 'Cobalt Harrier',
          tagline: 'Calm hands, cold tyres, clean laps.',
          colour: '#2d6cff',
          car: 'raceCarWhite',
          number: '21',
        },
        {
          name: 'Verdant Arrow',
          tagline: 'Built for the long run.',
          colour: '#1fcf7a',
          car: 'raceCarGreen',
          number: '33',
        },
        {
          name: 'Ivory Standard',
          tagline: 'Old money, new lap record.',
          colour: '#eae7de',
          car: 'raceCarRed',
          number: '88',
        },
      ] satisfies Team[],
    },
    tickets: {
      id: 'tickets',
      nav: 'Tickets',
      weight: 1.5,
      kicker: '07 / Tickets',
      heading: 'Pick your side of the fence.',
      body: 'Sample tiers and prices only. There is no checkout on this site.',
      priceNote: 'Sample price, not for sale',
      tiers: [
        {
          name: 'Paddock Day',
          priceInr: 1200,
          perks: ['One day entry', 'General viewing areas', 'Paddock walk'],
        },
        {
          name: 'Grandstand Weekend',
          priceInr: 3500,
          perks: ['Three days', 'Covered grandstand seat', 'Race programme'],
        },
        {
          name: 'Pit Lane Pass',
          priceInr: 8000,
          perks: ['Three days', 'Pit lane access', 'Garage tour', 'Lounge'],
        },
      ] satisfies TicketTier[],
    },
    finale: {
      id: 'finale',
      nav: 'Finale',
      weight: 1.4,
      kicker: '08 / See you there',
      heading: 'See you on the grid',
      body: 'Leave an email and we would tell you when tickets open, if this were a real event. It is a demo: nothing is sent or stored.',
      form: {
        label: 'Email address',
        placeholder: 'you@example.com',
        button: 'Notify me',
        errorEmpty: 'Enter your email address.',
        errorInvalid: 'That email address does not look right.',
        success: 'Thanks. This is a demo, so nothing was saved or sent.',
      },
    },
  },

  footer: {
    credit: '3D models: Racing Kit by Kenney (kenney.nl), CC0 1.0.',
  },

  /** Text shown when WebGL or the 3D scene is unavailable. */
  fallback: {
    noWebgl: 'The 3D track needs WebGL, which is not available here. Showing the still version.',
    modelError: 'Some 3D models did not load. The page still works.',
  },
} as const;

export type Content = typeof content;

/** Chapter ids in scroll order. */
export const CHAPTER_ORDER = [
  'hero',
  'track',
  'corner1',
  'straight',
  'schedule',
  'teams',
  'tickets',
  'finale',
] as const;

export type ChapterId = (typeof CHAPTER_ORDER)[number];

export function chapterList(c: Content = content): (ChapterBase & { id: ChapterId })[] {
  return CHAPTER_ORDER.map((id) => c.chapters[id]);
}
