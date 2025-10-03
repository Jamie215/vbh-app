// Supabase configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || '';

// YouTube configuration
const YOUTUBE_API_KEY = window.ENV?.YOUTUBE_API_KEY || '';

// Check if keys are configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !YOUTUBE_API_KEY) {
    console.error('Missing API keys. Please configure environment variables.');
}

// Playlist structure
const PLAYLISTS = [
    {
        id: 'beginner-0-3',
        title: 'Beginner 0-3',
        description: 'Light load workout for starting',
        thumbnail: 'https://img.youtube.com/vi/zijGs3hmXnE/maxresdefault.jpg',
        videos: [
            {
                id: 'zijGs3hmXnE',
                title: 'Squats',
                sets: 3,
                reps: 8,
                equipment: null,
                thumbnail: 'https://img.youtube.com/vi/zijGs3hmXnE/maxresdefault.jpg',
                order: 1
            },
            {
                id: 'Sc7w24mG8LE',
                title: 'Test Video',
                sets: 3,
                reps: 8,
                equipment: "Cloth",
                thumbnail: 'https://img.youtube.com/vi/Sc7w24mG8LE/maxresdefault.jpg',
                order: 2
            }
        ]
    },
    {
        id: 'intermediate-0-3',
        title: 'Intermediate 0-3',
        description: 'Intermediate load workout for more challenge',
        thumbnail: 'https://img.youtube.com/vi/Sc7w24mG8LE/maxresdefault.jpg',
        videos: [
            {
                id: 'Sc7w24mG8LE',
                title: 'Test Video',
                sets: 3,
                reps: 8,
                equipment: "Cloth",
                thumbnail: 'https://img.youtube.com/vi/Sc7w24mG8LE/maxresdefault.jpg',
                order: 1
            },
            {
                id: 'zijGs3hmXnE',
                title: 'Squat',
                sets: 3,
                reps: 8,
                equipment: null,
                thumbnail: 'https://img.youtube.com/vi/zijGs3hmXnE/maxresdefault.jpg',
                order: 2
            }
        ]
    },

]

// Your video library
const VIDEO_MODULES = [
    {
        id: 'zijGs3hmXnE',
        title: 'Squat',
        description: 'Squat Exercise Video',
        thumbnail: 'https://img.youtube.com/vi/zijGs3hmXnE/maxresdefault.jpg'
    }
];

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);