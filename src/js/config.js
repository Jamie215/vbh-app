// Supabase configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || '';

// Check if keys are configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing API keys. Please configure environment variables.');
}

// Playlist structure
const PLAYLISTS = [
    {
        id: 'beginner-0-3',
        title: 'Beginner Weeks 0-3',
        description: 'Workout playlist for Week 0 to 3',
        thumbnail: 'https://img.youtube.com/vi/hq60J8wfNZY/hqdefault.jpg',
        videos: [
            {
                id: 'hq60J8wfNZY',
                title: 'Reverse Lunge',
                sets: 3,
                reps: 8,
                seconds: 0,
                equipment: ["Chair (Easier)", "No Chair (More Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/hq60J8wfNZY/hqdefault.jpg',
                order: 1
            },
            {
                id: 'bcEDTtncUD0',
                title: 'Squat',
                sets: 3,
                reps: 8,
                seconds: 0,
                equipment:["Chair (Easier)", "No Chair (More Challenging)", "Weight (Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/bcEDTtncUD0/hqdefault.jpg',
                order: 2
            }
        ]
    },
    {
        id: 'advanced-4-6',
        title: 'Advanced Weeks 4-6',
        description: 'Workout playlist for Week 4 to 6',
        thumbnail: 'https://img.youtube.com/vi/6a3qaXho5Q4/hqdefault.jpg',
        videos: [
            {
                id: '6a3qaXho5Q4',
                title: 'Single Leg Deadlift',
                sets: 3,
                reps: 8,
                seconds: 0,
                equipment: ["Chair (Easier)", "No Chair (More Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/6a3qaXho5Q4/hqdefault.jpg',
                order: 1
            },
            {
                id: '2bRnmaLAS7o',
                title: 'Hip Hinge',
                sets: 3,
                reps: 8,
                seconds: 0,
                equipment: ["Dowel (Easier)", "Weights (More Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/2bRnmaLAS7o/hqdefault.jpg',
                order: 2
            },
            {
                id: 'gqzZ0ExlyMc',
                title: 'Band External Rotation',
                sets: 3,
                reps: 8,
                seconds: 0,
                equipment: ["Resistance Band"],
                thumbnail: 'https://img.youtube.com/vi/gqzZ0ExlyMc/hqdefault.jpg',
                order: 1
            }
        ]
    }
];

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);