// Supabase configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || '';

// YouTube configuration
const YOUTUBE_API_KEY = window.ENV?.YOUTUBE_API_KEY || '';

// Check if keys are configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !YOUTUBE_API_KEY) {
    console.error('Missing API keys. Please configure environment variables.');
}

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