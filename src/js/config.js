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
        title: 'Beginner 0-3',
        description: 'Light load workout for starting',
        thumbnail: 'https://img.youtube.com/vi/hq60J8wfNZY/maxresdefault.jpg',
        videos: [
            {
                id: 'hq60J8wfNZY',
                title: 'Reverse Lunge',
                sets: 3,
                reps: 8,
                equipment: ["Chair (Easier)", "No Chair (More Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/hq60J8wfNZY/maxresdefault.jpg',
                order: 1
            },
            {
                id: 'bcEDTtncUD0',
                title: 'Squat',
                sets: 3,
                reps: 8,
                equipment:["Chair (Easier)", "No Chair (More Challenging)", "Weight (Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/bcEDTtncUD0/maxresdefault.jpg',
                order: 2
            }
        ]
    },
    {
        id: 'intermediate-0-3',
        title: 'Intermediate 0-3',
        description: 'Intermediate load workout for more challenge',
        thumbnail: 'https://img.youtube.com/vi/6a3qaXho5Q4/maxresdefault.jpg',
        videos: [
            {
                id: '6a3qaXho5Q4',
                title: 'Single Leg Deadlift',
                sets: 3,
                reps: 8,
                equipment: ["Chair (Easier)", "No Chair (More Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/6a3qaXho5Q4/maxresdefault.jpg',
                order: 1
            },
            {
                id: '8RTh6Oh0weY',
                title: 'Hip Hinge',
                sets: 3,
                reps: 8,
                equipment: ["Dowel (Easier)", "Weights (More Challenging)"],
                thumbnail: 'https://img.youtube.com/vi/8RTh6Oh0weY/maxresdefault.jpg',
                order: 2
            }
        ]
    },
    {
        id: 'advanced-0-3',
        title: 'Advanced 0-3',
        description: 'Advanced load workout for most challenge',
        thumbnail: 'https://img.youtube.com/vi/gqzZ0ExlyMc/maxresdefault.jpg',
        videos: [
            {
                id: 'gqzZ0ExlyMc',
                title: 'Band External Rotation',
                sets: 3,
                reps: 8,
                equipment: ["Resistance Band"],
                thumbnail: 'https://img.youtube.com/vi/gqzZ0ExlyMc/maxresdefault.jpg',
                order: 1
            }
        ]
    }
]

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);