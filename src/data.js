// Mock data for the Loopd prototype. Every screen reads from here so the
// whole app can be swapped to a real backend later without touching UI code.

export const currentUser = {
  id: 'u0',
  name: 'Kiran Rushton',
  username: 'kiran',
  avatar: '🏌️',
  followers: 128,
  following: 143,
}

export const users = [
  { id: 'u1', name: 'Tommy Ashe', username: 'tommya', avatar: '⛳', played: 74, followers: 301, following: 210 },
  { id: 'u2', name: 'Maya Chen', username: 'mayagolfs', avatar: '🐦', played: 61, followers: 254, following: 180 },
  { id: 'u3', name: 'Jack Doyle', username: 'jdoyle', avatar: '🦅', played: 58, followers: 199, following: 167 },
  { id: 'u4', name: 'Sofia Reyes', username: 'sofiar', avatar: '🌵', played: 45, followers: 178, following: 155 },
  { id: 'u5', name: 'Ben Okafor', username: 'benok', avatar: '🔥', played: 39, followers: 143, following: 120 },
  { id: 'u6', name: 'Liv Patterson', username: 'livp', avatar: '🍀', played: 33, followers: 122, following: 98 },
  { id: 'u7', name: 'Sam Whitfield', username: 'samw', avatar: '🌊', played: 27, followers: 89, following: 104 },
]

export const courses = [
  {
    id: 'c1',
    name: 'Pebble Beach Golf Links',
    lat: 36.5674, lng: -121.9500,
    city: 'Pebble Beach', state: 'CA', country: 'USA',
    rating: 9.6, numRatings: 1284,
    yourScore: 9.8, friendsScore: 9.4,
    website: 'pebblebeach.com', phone: '(800) 877-0597',
    access: 'Public', par: 72, yardage: 7075,
    region: 'Monterey Peninsula',
    photos: [
      { grad: ['#7ec8a9', '#2f6d4f'], caption: 'The 7th at sunrise' },
      { grad: ['#a9d3e8', '#4b7ea3'], caption: '18th along Stillwater Cove' },
    ],
    notes: [
      { user: 'tommya', avatar: '⛳', score: 9.2, text: 'Bucket list round. Caddie was worth every penny — greens are tiny and firm.' },
      { user: 'mayagolfs', avatar: '🐦', score: 9.5, text: 'Play it at dawn. Fog burning off the cove on 6–8 is unreal.' },
    ],
  },
  {
    id: 'c2',
    name: 'Bethpage Black',
    lat: 40.7448, lng: -73.4534,
    city: 'Farmingdale', state: 'NY', country: 'USA',
    rating: 9.1, numRatings: 2101,
    yourScore: 8.7, friendsScore: 9.0,
    website: 'parks.ny.gov', phone: '(516) 249-0700',
    access: 'Public', par: 71, yardage: 7468,
    region: 'Long Island',
    photos: [
      { grad: ['#9ec98f', '#3c6b3c'], caption: 'The warning sign' },
    ],
    notes: [
      { user: 'jdoyle', avatar: '🦅', score: 9.0, text: 'Slept in the parking lot for a tee time. Zero regrets. Bring your A-game off the tee.' },
    ],
  },
  {
    id: 'c3',
    name: 'Pacific Dunes',
    lat: 43.1857, lng: -124.3979,
    city: 'Bandon', state: 'OR', country: 'USA',
    rating: 9.4, numRatings: 876,
    yourScore: null, friendsScore: 9.2,
    website: 'bandondunesgolf.com', phone: '(855) 220-6710',
    access: 'Resort', par: 71, yardage: 6633,
    region: 'Oregon Coast',
    photos: [
      { grad: ['#d9c58a', '#8a6f3c'], caption: 'Blowout bunkers on 11' },
    ],
    notes: [
      { user: 'mayagolfs', avatar: '🐦', score: 9.2, text: 'Best walk in golf. Wind makes it a different course every day.' },
    ],
  },
  {
    id: 'c4',
    name: 'TPC Sawgrass (Stadium)',
    lat: 30.1975, lng: -81.3959,
    city: 'Ponte Vedra Beach', state: 'FL', country: 'USA',
    rating: 8.9, numRatings: 1542,
    yourScore: 8.5, friendsScore: 8.8,
    website: 'tpc.com', phone: '(904) 273-3235',
    access: 'Resort', par: 72, yardage: 7245,
    region: 'North Florida',
    photos: [
      { grad: ['#8fd0c9', '#2e6e66'], caption: 'Island green, 17th' },
    ],
    notes: [
      { user: 'benok', avatar: '🔥', score: 8.4, text: 'Put two in the water on 17 and still smiled the whole way in.' },
    ],
  },
  {
    id: 'c5',
    name: 'Chambers Bay',
    lat: 47.1885, lng: -122.5735,
    city: 'University Place', state: 'WA', country: 'USA',
    rating: 8.3, numRatings: 623,
    yourScore: null, friendsScore: 8.1,
    website: 'chambersbaygolf.com', phone: '(253) 460-4653',
    access: 'Public', par: 72, yardage: 7165,
    region: 'Puget Sound',
    photos: [
      { grad: ['#c9b98a', '#6e8a6e'], caption: 'Lone fir on 15' },
    ],
    notes: [],
  },
  {
    id: 'c6',
    name: 'Whistling Straits (Straits)',
    lat: 43.8508, lng: -87.7145,
    city: 'Sheboygan', state: 'WI', country: 'USA',
    rating: 9.0, numRatings: 934,
    yourScore: 8.9, friendsScore: 8.7,
    website: 'destinationkohler.com', phone: '(855) 444-2838',
    access: 'Resort', par: 72, yardage: 7790,
    region: 'Lake Michigan Shore',
    photos: [
      { grad: ['#a9c9e8', '#3c5c8a'], caption: 'Bluffs over Lake Michigan' },
    ],
    notes: [
      { user: 'livp', avatar: '🍀', score: 8.8, text: 'A thousand bunkers and I found most of them. Views forever.' },
    ],
  },
  {
    id: 'c7',
    name: 'Erin Hills',
    lat: 43.2604, lng: -88.3620,
    city: 'Erin', state: 'WI', country: 'USA',
    rating: 8.6, numRatings: 445,
    yourScore: null, friendsScore: 8.5,
    website: 'erinhills.com', phone: '(866) 772-4769',
    access: 'Public', par: 72, yardage: 7731,
    region: 'Kettle Moraine',
    photos: [],
    notes: [],
  },
  {
    id: 'c8',
    name: 'Pinehurst No. 2',
    lat: 35.1898, lng: -79.4686,
    city: 'Pinehurst', state: 'NC', country: 'USA',
    rating: 9.2, numRatings: 1367,
    yourScore: 9.0, friendsScore: 9.1,
    website: 'pinehurst.com', phone: '(855) 235-8507',
    access: 'Resort', par: 72, yardage: 7588,
    region: 'Sandhills',
    photos: [
      { grad: ['#d9b98a', '#8a5c3c'], caption: 'Turtleback greens' },
    ],
    notes: [
      { user: 'tommya', avatar: '⛳', score: 9.3, text: 'Short game exam. I chipped with everything from putter to 7-iron.' },
    ],
  },
  {
    id: 'c9',
    name: 'Harbour Town Golf Links',
    lat: 32.1394, lng: -80.8103,
    city: 'Hilton Head Island', state: 'SC', country: 'USA',
    rating: 8.4, numRatings: 712,
    yourScore: null, friendsScore: 8.2,
    website: 'seapines.com', phone: '(843) 842-8484',
    access: 'Resort', par: 71, yardage: 7213,
    region: 'Lowcountry',
    photos: [
      { grad: ['#e8c9a9', '#a35c4b'], caption: 'The lighthouse on 18' },
    ],
    notes: [],
  },
  {
    id: 'c10',
    name: 'Gamble Sands',
    lat: 48.1229, lng: -119.7823,
    city: 'Brewster', state: 'WA', country: 'USA',
    rating: 8.8, numRatings: 389,
    yourScore: null, friendsScore: 8.9,
    website: 'gamblesands.com', phone: '(509) 436-8323',
    access: 'Resort', par: 72, yardage: 7169,
    region: 'Columbia River Valley',
    photos: [
      { grad: ['#e8d9a9', '#8a7f3c'], caption: 'Wide open high desert golf' },
    ],
    notes: [
      { user: 'samw', avatar: '🌊', score: 9.0, text: 'Most fun I have ever had on a course. Everything funnels toward the hole.' },
    ],
  },
]

// Feed: what your friends have been playing, newest first.
export const feed = [
  { id: 'f1', userId: 'u2', courseId: 'c3', score: 9.2, when: '2h ago', note: 'Best walk in golf. Wind makes it a different course every day.', photo: { grad: ['#d9c58a', '#8a6f3c'], caption: 'Blowout bunkers on 11' } },
  { id: 'f2', userId: 'u1', courseId: 'c1', score: 9.2, when: '5h ago', note: 'Bucket list round. Caddie was worth every penny.', photo: { grad: ['#a9d3e8', '#4b7ea3'], caption: '18th along Stillwater Cove' } },
  { id: 'f3', userId: 'u5', courseId: 'c4', score: 8.4, when: 'Yesterday', note: 'Put two in the water on 17 and still smiled the whole way in.', photo: null },
  { id: 'f4', userId: 'u7', courseId: 'c10', score: 9.0, when: 'Yesterday', note: 'Most fun I have ever had on a course.', photo: { grad: ['#e8d9a9', '#8a7f3c'], caption: 'High desert golf' } },
  { id: 'f5', userId: 'u3', courseId: 'c2', score: 9.0, when: '2d ago', note: 'Slept in the parking lot for a tee time. Zero regrets.', photo: { grad: ['#9ec98f', '#3c6b3c'], caption: 'The warning sign' } },
  { id: 'f6', userId: 'u6', courseId: 'c6', score: 8.8, when: '3d ago', note: 'A thousand bunkers and I found most of them.', photo: null },
]

// Your lists
export const played = ['c1', 'c2', 'c4', 'c6', 'c8']
export const bookmarked = ['c3', 'c5', 'c10']
export const recs = ['c7', 'c9', 'c3']

export const guides = [
  { id: 'g1', title: "America's 100 Greatest Public Courses", source: 'Golf Digest', count: 100, grad: ['#2f6d4f', '#123324'] },
  { id: 'g2', title: 'Best Buddies-Trip Destinations', source: 'Golf Digest', count: 12, grad: ['#4b7ea3', '#1d3a52'] },
  { id: 'g3', title: 'Top 50 Courses You Can Actually Play', source: "Golfer's Journal", count: 50, grad: ['#8a5c3c', '#3d2413'] },
  { id: 'g4', title: 'Pacific Northwest Road Trip', source: 'Loopd Editors', count: 8, grad: ['#3c5c8a', '#141f33'] },
]

export const leaderboard = [
  { userId: 'u1', played: 74, delta: '+3 this month' },
  { userId: 'u2', played: 61, delta: '+5 this month' },
  { userId: 'u3', played: 58, delta: '+1 this month' },
  { userId: 'u4', played: 45, delta: '+2 this month' },
  { userId: 'u5', played: 39, delta: '—' },
  { userId: 'u6', played: 33, delta: '+4 this month' },
  { userId: 'u7', played: 27, delta: '+1 this month' },
]

export const userById = (id) =>
  id === 'u0' ? currentUser : users.find((u) => u.id === id)

// Courses discovered via live search (OSM) register here so courseById,
// lists, the map, and the rank flow resolve them exactly like seed courses.
const customCourses = new Map()

export function registerCourse(course) {
  if (!courses.some((c) => c.id === course.id)) customCourses.set(course.id, course)
}

export const allCourses = () => [...courses, ...customCourses.values()]

export const courseById = (id) => courses.find((c) => c.id === id) ?? customCourses.get(id)
