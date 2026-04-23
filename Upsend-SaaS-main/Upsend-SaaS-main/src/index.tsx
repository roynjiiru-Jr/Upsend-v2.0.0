import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings } from './types';

// Import routes
import auth from './routes/auth';
import events from './routes/events';
import messages from './routes/messages';
import contributions from './routes/contributions';

const app = new Hono<{ Bindings: Bindings }>();

// PWA meta tags helper
const PWA_META_TAGS = `
    <link rel="manifest" href="/static/manifest.json">
    <meta name="theme-color" content="#8B5CF6">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Upsend">
    <link rel="apple-touch-icon" href="/static/icons/icon-192.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/static/icons/icon-192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/static/icons/icon-512.png">
`;

// Enable CORS
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// API routes
app.route('/api/auth', auth);
app.route('/api/events', events);
app.route('/api/messages', messages);
app.route('/api/contributions', contributions);

// Image upload endpoint
app.post('/api/upload-image', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File;

    if (!file) return c.json({ error: 'No image file provided' }, 400);
    if (!file.type.startsWith('image/')) return c.json({ error: 'File must be an image' }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Image must be less than 5MB' }, 400);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const key = `events/${timestamp}-${randomStr}.${extension}`;

    await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

    return c.json({ success: true, url: `/api/images/${key}`, key });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to upload image' }, 500);
  }
});

// Serve images from R2
app.get('/api/images/*', async (c) => {
  try {
    const key = c.req.path.replace('/api/images/', '');
    const object = await c.env.IMAGES.get(key);
    if (!object) return c.notFound();
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Image serving error:', error);
    return c.notFound();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Upsend - Create Beautiful Event Pages</title>
        ${PWA_META_TAGS}
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 min-h-screen">
        <div class="container mx-auto px-4 py-16">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="text-6xl font-bold text-gray-800 mb-6">
                    <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Upsend</span>
                </h1>
                <p class="text-2xl text-gray-600 mb-4">
                    Create beautiful event pages to collect messages &amp; contributions
                </p>
                <p class="text-base text-gray-500 mb-8">
                    Share your M-Pesa, bank, or any payment details — guests contribute directly to you. No middleman fees.
                </p>
                <div class="space-x-4">
                    <a href="/auth" class="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
                        Get Started
                    </a>
                    <a href="/auth" class="inline-block px-8 py-4 bg-white text-gray-700 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
                        Sign In
                    </a>
                </div>
            </div>

            <div class="grid md:grid-cols-3 gap-8 mt-20 max-w-5xl mx-auto">
                <div class="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                    <div class="text-4xl mb-4 text-purple-600"><i class="fas fa-calendar-plus"></i></div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Create Events</h3>
                    <p class="text-gray-600">Set up beautiful event pages in seconds with your own payment details</p>
                </div>
                <div class="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                    <div class="text-4xl mb-4 text-pink-600"><i class="fas fa-mobile-alt"></i></div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Direct Payments</h3>
                    <p class="text-gray-600">Share M-Pesa, Paybill, Till, or bank details — guests pay you directly</p>
                </div>
                <div class="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                    <div class="text-4xl mb-4 text-blue-600"><i class="fas fa-chart-line"></i></div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Track Everything</h3>
                    <p class="text-gray-600">View messages publicly and track who has contributed privately</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAGE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/auth', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign In - Upsend</title>
        ${PWA_META_TAGS}
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 min-h-screen">
        <div class="container mx-auto px-4 py-16">
            <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <h2 class="text-3xl font-bold text-center mb-2 text-gray-800">Welcome to Upsend</h2>
                <p class="text-center text-gray-600 mb-8">Sign in with your email</p>

                <div id="auth-form">
                    <div class="mb-4">
                        <label class="block text-gray-700 font-medium mb-2">Email</label>
                        <input type="email" id="email" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="you@example.com" required>
                    </div>
                    <div class="mb-6" id="name-field" style="display:none;">
                        <label class="block text-gray-700 font-medium mb-2">Name</label>
                        <input type="text" id="name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="Your name">
                    </div>
                    <button onclick="requestMagicLink()" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all duration-200">
                        Continue with Email
                    </button>
                </div>

                <div id="magic-link-sent" style="display:none;" class="text-center">
                    <div class="text-6xl text-green-500 mb-4">✓</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Check your email!</h3>
                    <p class="text-gray-600 mb-4">We've sent you a magic link to sign in.</p>
                    <p class="text-sm text-gray-500">For MVP testing, click the link below:</p>
                    <a id="dev-link" href="#" class="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Verify Magic Link
                    </a>
                </div>

                <div id="error-message" class="mt-4 p-3 bg-red-100 text-red-700 rounded-lg" style="display:none;"></div>
            </div>
        </div>

        <script>
            async function requestMagicLink() {
                const email = document.getElementById('email').value;
                const name = document.getElementById('name').value;
                const errorDiv = document.getElementById('error-message');
                if (!email) { errorDiv.textContent = 'Please enter your email'; errorDiv.style.display = 'block'; return; }
                try {
                    const response = await axios.post('/api/auth/magic-link', { email, name: name || undefined });
                    if (response.data.success) {
                        document.getElementById('auth-form').style.display = 'none';
                        document.getElementById('magic-link-sent').style.display = 'block';
                        if (response.data.dev_link) {
                            document.getElementById('dev-link').href = response.data.dev_link;
                            document.getElementById('dev-link').onclick = (e) => { e.preventDefault(); verifyToken(response.data.dev_token); };
                        }
                    }
                } catch (error) {
                    if (error.response?.data?.error === 'Name is required for new users') {
                        document.getElementById('name-field').style.display = 'block';
                        errorDiv.textContent = 'Please enter your name to create an account';
                    } else {
                        errorDiv.textContent = error.response?.data?.error || 'Failed to send magic link';
                    }
                    errorDiv.style.display = 'block';
                }
            }

            async function verifyToken(token) {
                try {
                    const response = await axios.post('/api/auth/verify', { token });
                    if (response.data.success) {
                        localStorage.setItem('session_token', response.data.session_token);
                        localStorage.setItem('user', JSON.stringify(response.data.user));
                        window.location.href = '/dashboard';
                    }
                } catch (error) {
                    document.getElementById('error-message').textContent = 'Failed to verify token';
                    document.getElementById('error-message').style.display = 'block';
                }
            }

            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (token) verifyToken(token);
        </script>
    </body>
    </html>
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Upsend</title>
        ${PWA_META_TAGS}
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen">
        <nav class="bg-white shadow-sm">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <a href="/dashboard" class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Upsend</a>
                    <div class="flex items-center gap-4">
                        <span id="user-name" class="text-gray-700"></span>
                        <button onclick="logout()" class="text-gray-600 hover:text-gray-800"><i class="fas fa-sign-out-alt"></i> Logout</button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-8">
            <div class="max-w-6xl mx-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800">My Events</h2>
                    <a href="/create-event" class="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
                        <i class="fas fa-plus mr-2"></i>Create Event
                    </a>
                </div>

                <div class="mb-6">
                    <div class="relative max-w-md">
                        <input type="text" id="search-input" placeholder="Search events…"
                            class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            oninput="filterEvents()">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    </div>
                </div>

                <div id="events-list" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div class="text-center py-12 col-span-full"><div class="text-gray-400 text-lg">Loading events…</div></div>
                </div>
            </div>
        </div>

        <script>
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('session_token');
            let allEvents = [];

            async function checkAuth() {
                try {
                    const response = await axios.get('/api/auth/me');
                    document.getElementById('user-name').textContent = response.data.user.name;
                    loadEvents();
                } catch { window.location.href = '/auth'; }
            }

            async function loadEvents() {
                try {
                    const response = await axios.get('/api/events/creator/list');
                    allEvents = response.data.events;
                    displayEvents(allEvents);
                } catch (error) { console.error('Failed to load events:', error); }
            }

            function paymentBadge(event) {
                const methodLabels = {
                    mpesa_phone: { label: 'M-Pesa Send Money', icon: 'fa-mobile-alt', color: 'green' },
                    mpesa_paybill: { label: 'M-Pesa Paybill', icon: 'fa-building', color: 'green' },
                    mpesa_till: { label: 'M-Pesa Till', icon: 'fa-store', color: 'green' },
                    bank_transfer: { label: 'Bank Transfer', icon: 'fa-university', color: 'blue' },
                    external_link: { label: 'External Link', icon: 'fa-link', color: 'purple' },
                };
                const m = event.payment_method ? methodLabels[event.payment_method] : null;
                if (!m) return '<span class="text-xs text-gray-400"><i class="fas fa-credit-card mr-1"></i>No payment set</span>';
                return '<span class="text-xs text-' + m.color + '-700 bg-' + m.color + '-50 px-2 py-0.5 rounded-full"><i class="fas ' + m.icon + ' mr-1"></i>' + m.label + '</span>';
            }

            function displayEvents(events) {
                const container = document.getElementById('events-list');
                if (events.length === 0) {
                    const q = document.getElementById('search-input').value;
                    container.innerHTML = '<div class="col-span-full text-center py-12">' +
                        (q ? '<div class="text-gray-400 text-lg mb-4">No events found matching "' + q + '"</div><button onclick="clearSearch()" class="text-purple-600 hover:text-purple-700 font-medium">Clear search</button>'
                           : '<div class="text-gray-400 text-lg mb-4">No events yet</div><a href="/create-event" class="text-purple-600 hover:text-purple-700 font-medium">Create your first event</a>') +
                        '</div>';
                    return;
                }
                container.innerHTML = events.map(event => \`
                    <div class="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                        \${event.cover_image ? '<img src="' + event.cover_image + '" class="w-full h-48 object-cover">' : '<div class="w-full h-48 bg-gradient-to-br from-purple-400 to-pink-400"></div>'}
                        <div class="p-6">
                            <h3 class="text-xl font-bold text-gray-800 mb-1">\${event.title}</h3>
                            <p class="text-gray-600 text-sm mb-2"><i class="far fa-calendar mr-1"></i>\${new Date(event.event_date).toLocaleDateString()}</p>
                            <div class="mb-3">\${paymentBadge(event)}</div>
                            <div class="flex justify-between text-sm text-gray-600 mb-4">
                                <span><i class="far fa-comment mr-1"></i>\${event.message_count || 0} messages</span>
                                <span><i class="fas fa-hand-holding-usd mr-1"></i>\${event.contribution_count || 0} contributions</span>
                            </div>
                            <div class="flex gap-2">
                                <a href="/event-details/\${event.id}" class="flex-1 px-4 py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700 transition-colors text-sm">
                                    View Details
                                </a>
                                <button onclick="copyLink('\${event.shareable_link}')" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm" title="Copy link">
                                    <i class="fas fa-link"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                \`).join('');
            }

            function filterEvents() {
                const q = document.getElementById('search-input').value.toLowerCase().trim();
                if (!q) { displayEvents(allEvents); return; }
                displayEvents(allEvents.filter(e =>
                    (e.title || '').toLowerCase().includes(q) ||
                    (e.description || '').toLowerCase().includes(q) ||
                    new Date(e.event_date).toLocaleDateString().toLowerCase().includes(q)
                ));
            }

            function clearSearch() { document.getElementById('search-input').value = ''; displayEvents(allEvents); }

            function copyLink(shareableLink) {
                navigator.clipboard.writeText(window.location.origin + '/event/' + shareableLink);
                alert('Link copied to clipboard!');
            }

            function logout() {
                axios.post('/api/auth/logout');
                localStorage.clear();
                window.location.href = '/';
            }

            checkAuth();
        </script>
    </body>
    </html>
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EVENT PAGE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/create-event', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Create Event - Upsend</title>
        ${PWA_META_TAGS}
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js"></script>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <nav class="bg-white shadow-sm">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <a href="/dashboard" class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Upsend</a>
                    <a href="/dashboard" class="text-gray-600 hover:text-gray-800"><i class="fas fa-arrow-left mr-2"></i>Back to Dashboard</a>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-8">
            <div class="max-w-2xl mx-auto">
                <h2 class="text-3xl font-bold text-gray-800 mb-8">Create New Event</h2>

                <form id="create-event-form" class="space-y-6">

                    <!-- ── Event Info ─────────────────────────────────────── -->
                    <div class="bg-white rounded-xl shadow-md p-6">
                        <h3 class="text-lg font-semibold text-gray-700 mb-4"><i class="fas fa-info-circle mr-2 text-purple-500"></i>Event Details</h3>

                        <div class="mb-4">
                            <label class="block text-gray-700 font-medium mb-2">Event Title <span class="text-red-500">*</span></label>
                            <input type="text" id="title" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="Birthday Party, Wedding, Fundraiser…" required>
                        </div>

                        <div class="mb-4">
                            <label class="block text-gray-700 font-medium mb-2">Description</label>
                            <textarea id="description" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="Tell guests about your event…"></textarea>
                        </div>

                        <div class="mb-4">
                            <label class="block text-gray-700 font-medium mb-2">Event Date <span class="text-red-500">*</span></label>
                            <input type="date" id="event_date" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" required>
                        </div>

                        <!-- Images -->
                        <div>
                            <label class="block text-gray-700 font-medium mb-2">Event Images (optional, up to 5)</label>
                            <div id="drop-zone" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer">
                                <input type="file" id="cover_image" accept="image/*" multiple class="hidden">
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                                <p class="text-gray-600 mb-1">Drag &amp; drop or click to browse</p>
                                <p class="text-sm text-gray-400">PNG, JPG up to 5MB each</p>
                            </div>
                            <div id="images-grid" class="mt-4 grid grid-cols-3 gap-3" style="display:none;"></div>
                            <div id="upload-status" class="mt-2 text-sm text-gray-600"></div>
                        </div>
                    </div>

                    <!-- ── Payment Details ────────────────────────────────── -->
                    <div class="bg-white rounded-xl shadow-md p-6">
                        <h3 class="text-lg font-semibold text-gray-700 mb-1"><i class="fas fa-money-bill-wave mr-2 text-green-500"></i>Payment Details</h3>
                        <p class="text-sm text-gray-500 mb-4">Tell guests how to send their contributions directly to you.</p>

                        <div class="mb-4">
                            <label class="block text-gray-700 font-medium mb-2">Payment Method</label>
                            <select id="payment_method" onchange="updatePaymentFields()"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent bg-white">
                                <option value="">— No payment (messages only) —</option>
                                <option value="mpesa_phone">M-Pesa Send Money (Phone Number)</option>
                                <option value="mpesa_paybill">M-Pesa Paybill</option>
                                <option value="mpesa_till">M-Pesa Buy Goods (Till Number)</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="external_link">External Payment Link</option>
                            </select>
                        </div>

                        <!-- mpesa_phone fields -->
                        <div id="fields-mpesa_phone" class="space-y-4 hidden">
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Phone Number <span class="text-red-500">*</span></label>
                                <input type="tel" id="payment_phone" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="e.g. 0712 345 678">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Account Name <span class="text-red-500">*</span></label>
                                <input type="text" id="payment_name_phone" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="e.g. Jane Doe">
                            </div>
                        </div>

                        <!-- mpesa_paybill fields -->
                        <div id="fields-mpesa_paybill" class="space-y-4 hidden">
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Business / Paybill Number <span class="text-red-500">*</span></label>
                                <input type="text" id="payment_paybill" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="e.g. 247247">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Account Number <span class="text-red-500">*</span></label>
                                <input type="text" id="payment_account" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="e.g. your name or event code">
                            </div>
                        </div>

                        <!-- mpesa_till fields -->
                        <div id="fields-mpesa_till" class="space-y-4 hidden">
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Till Number <span class="text-red-500">*</span></label>
                                <input type="text" id="payment_till" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="e.g. 123456">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Business / Till Name <span class="text-red-500">*</span></label>
                                <input type="text" id="payment_name_till" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="e.g. Jane's Events">
                            </div>
                        </div>

                        <!-- bank_transfer fields -->
                        <div id="fields-bank_transfer" class="space-y-4 hidden">
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Bank &amp; Account Details</label>
                                <textarea id="payment_account_bank" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Bank: Equity Bank&#10;Account Name: Jane Doe&#10;Account No: 0123456789&#10;Branch: Nairobi CBD"></textarea>
                                <p class="text-xs text-gray-400 mt-1">Enter all relevant bank details; these will be shown to guests.</p>
                            </div>
                        </div>

                        <!-- external_link fields -->
                        <div id="fields-external_link" class="space-y-4 hidden">
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Payment Link <span class="text-red-500">*</span></label>
                                <input type="url" id="payment_link" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="https://...">
                                <p class="text-xs text-gray-400 mt-1">e.g. PayPal.me, GoFundMe, or any other link</p>
                            </div>
                        </div>
                    </div>

                    <!-- Submit -->
                    <button type="submit" id="submit-btn" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 rounded-xl hover:shadow-lg transition-all duration-200 text-lg">
                        <i class="fas fa-rocket mr-2"></i>Create Event
                    </button>
                    <div id="error-message" class="p-3 bg-red-100 text-red-700 rounded-lg" style="display:none;"></div>
                </form>
            </div>
        </div>

        <!-- Crop Modal -->
        <div id="crop-modal" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" style="display:none;">
            <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-2xl font-bold text-gray-800">Crop &amp; Adjust Image</h3>
                        <button onclick="closeCropModal()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times text-2xl"></i></button>
                    </div>
                    <div class="mb-4"><img id="crop-image" style="max-width:100%;display:block;"></div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <button onclick="cropper.rotate(-45)" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><i class="fas fa-undo mr-2"></i>Rotate L</button>
                        <button onclick="cropper.rotate(45)"  class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><i class="fas fa-redo mr-2"></i>Rotate R</button>
                        <button onclick="cropper.scaleX(-cropper.getData().scaleX || -1)" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><i class="fas fa-arrows-alt-h mr-2"></i>Flip H</button>
                        <button onclick="cropper.scaleY(-cropper.getData().scaleY || -1)" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><i class="fas fa-arrows-alt-v mr-2"></i>Flip V</button>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-4">
                        <button onclick="cropper.setAspectRatio(NaN)" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">Free</button>
                        <button onclick="cropper.setAspectRatio(1)"    class="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">1:1</button>
                        <button onclick="cropper.setAspectRatio(16/9)" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">16:9</button>
                        <button onclick="cropper.setAspectRatio(4/3)"  class="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">4:3</button>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="closeCropModal()" class="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold">Cancel</button>
                        <button onclick="applyCrop()"      class="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg">Apply Crop</button>
                    </div>
                </div>
            </div>
        </div>

        <script>
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('session_token');

            // ── Payment field toggling ─────────────────────────────────────
            function updatePaymentFields() {
                const method = document.getElementById('payment_method').value;
                const allIds = ['mpesa_phone','mpesa_paybill','mpesa_till','bank_transfer','external_link'];
                allIds.forEach(id => document.getElementById('fields-' + id).classList.add('hidden'));
                if (method) document.getElementById('fields-' + method).classList.remove('hidden');
            }

            // ── Image handling ─────────────────────────────────────────────
            let selectedFiles = [];
            const MAX_FILES = 5;
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('cover_image');
            let cropper = null;
            let currentCroppingFile = null;

            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-purple-500','bg-purple-50'); });
            dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('border-purple-500','bg-purple-50'); });
            dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('border-purple-500','bg-purple-50'); handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))); });
            fileInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));

            async function handleFiles(files) {
                for (const file of files) {
                    if (selectedFiles.length >= MAX_FILES) { alert('Maximum ' + MAX_FILES + ' images allowed'); break; }
                    if (file.size > 5*1024*1024) { alert(file.name + ' is too large (max 5MB)'); continue; }
                    await openCropModal(file);
                }
                document.getElementById('images-grid').style.display = selectedFiles.length > 0 ? 'grid' : 'none';
            }

            function openCropModal(file) {
                return new Promise((resolve) => {
                    currentCroppingFile = file;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = document.getElementById('crop-image');
                        img.src = e.target.result;
                        document.getElementById('crop-modal').style.display = 'flex';
                        if (cropper) { cropper.destroy(); }
                        cropper = new Cropper(img, { viewMode:1, dragMode:'move', aspectRatio:NaN, autoCropArea:1, restore:false });
                        window.cropResolve = resolve;
                    };
                    reader.readAsDataURL(file);
                });
            }

            function closeCropModal() {
                document.getElementById('crop-modal').style.display = 'none';
                if (cropper) { cropper.destroy(); cropper = null; }
                if (window.cropResolve) window.cropResolve();
            }

            async function applyCrop() {
                if (!cropper) return;
                const canvas = cropper.getCroppedCanvas({ maxWidth:1920, maxHeight:1920, fillColor:'#fff' });
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], currentCroppingFile.name, { type:'image/jpeg', lastModified:Date.now() });
                    selectedFiles.push(file);
                    displayImagePreview(file, selectedFiles.length - 1);
                    closeCropModal();
                }, 'image/jpeg', 0.85);
            }

            function displayImagePreview(file, index) {
                const grid = document.getElementById('images-grid');
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'relative group';
                    div.innerHTML = '<img src="' + e.target.result + '" class="w-full h-28 object-cover rounded-lg border-2 border-gray-200">' +
                        '<div class="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-0.5 rounded">' + (index===0?'Cover':'Image '+(index+1)) + '</div>' +
                        '<button type="button" onclick="removeImage(' + index + ')" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-times text-xs"></i></button>';
                    grid.appendChild(div);
                };
                reader.readAsDataURL(file);
            }

            window.removeImage = function(index) {
                selectedFiles.splice(index, 1);
                const grid = document.getElementById('images-grid');
                grid.innerHTML = '';
                selectedFiles.forEach((f, i) => displayImagePreview(f, i));
                if (selectedFiles.length === 0) grid.style.display = 'none';
            };

            // ── Form submit ───────────────────────────────────────────────
            document.getElementById('create-event-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const title      = document.getElementById('title').value;
                const description = document.getElementById('description').value;
                const event_date = document.getElementById('event_date').value;
                const method     = document.getElementById('payment_method').value;
                const submitBtn  = document.getElementById('submit-btn');
                const statusDiv  = document.getElementById('upload-status');
                const errorDiv   = document.getElementById('error-message');
                errorDiv.style.display = 'none';

                // Collect payment fields
                const paymentData = {};
                if (method) {
                    paymentData.payment_method = method;
                    if (method === 'mpesa_phone') {
                        paymentData.payment_phone = document.getElementById('payment_phone').value.trim();
                        paymentData.payment_name  = document.getElementById('payment_name_phone').value.trim();
                        if (!paymentData.payment_phone) { errorDiv.textContent = 'Phone number is required for M-Pesa Send Money'; errorDiv.style.display='block'; return; }
                    } else if (method === 'mpesa_paybill') {
                        paymentData.payment_paybill = document.getElementById('payment_paybill').value.trim();
                        paymentData.payment_account = document.getElementById('payment_account').value.trim();
                        if (!paymentData.payment_paybill) { errorDiv.textContent = 'Paybill number is required'; errorDiv.style.display='block'; return; }
                    } else if (method === 'mpesa_till') {
                        paymentData.payment_till = document.getElementById('payment_till').value.trim();
                        paymentData.payment_name = document.getElementById('payment_name_till').value.trim();
                        if (!paymentData.payment_till) { errorDiv.textContent = 'Till number is required'; errorDiv.style.display='block'; return; }
                    } else if (method === 'bank_transfer') {
                        paymentData.payment_account = document.getElementById('payment_account_bank').value.trim();
                        if (!paymentData.payment_account) { errorDiv.textContent = 'Bank details are required'; errorDiv.style.display='block'; return; }
                    } else if (method === 'external_link') {
                        paymentData.payment_link = document.getElementById('payment_link').value.trim();
                        if (!paymentData.payment_link) { errorDiv.textContent = 'Payment link is required'; errorDiv.style.display='block'; return; }
                    }
                }

                try {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating…';

                    // Upload images
                    let cover_image_url = null;
                    const uploadedImages = [];
                    if (selectedFiles.length > 0) {
                        for (let i = 0; i < selectedFiles.length; i++) {
                            statusDiv.textContent = 'Uploading image ' + (i+1) + ' of ' + selectedFiles.length + '…';
                            const fd = new FormData();
                            fd.append('image', selectedFiles[i]);
                            const up = await axios.post('/api/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                            if (up.data.success) {
                                uploadedImages.push({ url: up.data.url, key: up.data.key, is_cover: i===0?1:0, display_order: i });
                                if (i === 0) cover_image_url = up.data.url;
                            }
                        }
                        statusDiv.textContent = 'Images uploaded!';
                    }

                    const response = await axios.post('/api/events/create', {
                        title, description: description || undefined, event_date,
                        cover_image: cover_image_url || undefined,
                        images: uploadedImages,
                        ...paymentData,
                    });

                    if (response.data.success) window.location.href = '/dashboard';
                } catch (error) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-rocket mr-2"></i>Create Event';
                    statusDiv.textContent = '';
                    errorDiv.textContent = error.response?.data?.error || 'Failed to create event';
                    errorDiv.style.display = 'block';
                }
            });

            // Auth check
            axios.get('/api/auth/me').catch(() => window.location.href = '/auth');
        </script>
    </body>
    </html>
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EVENT PAGE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/event/:shareableLink', async (c) => {
  const shareableLink = c.req.param('shareableLink');

  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event - Upsend</title>
        ${PWA_META_TAGS}
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="/static/slideshow.js"></script>
        <style>
            @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
            .fade-in { animation: fadeIn 0.3s ease-out; }
            .copy-btn:active { transform: scale(0.95); }
        </style>
    </head>
    <body class="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-4xl mx-auto">
                <div class="flex justify-end mb-4">
                    <a href="/" class="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all text-sm">
                        Create Your Own Event
                    </a>
                </div>
                <div id="event-content">
                    <div class="text-center py-12"><div class="text-gray-400 text-lg">Loading event…</div></div>
                </div>
            </div>
        </div>

        <!-- "I Have Contributed" Modal -->
        <div id="contribution-modal" class="fixed inset-0 bg-black bg-opacity-60 hidden items-center justify-center z-50 p-4" onclick="closeContributionModal(event)">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 fade-in" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-check-circle mr-2 text-green-500"></i>Confirm Your Contribution</h3>
                    <button onclick="closeContributionModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <p class="text-gray-600 text-sm mb-5">Please fill in your details so the organiser can track contributions.</p>

                <div class="space-y-4">
                    <div>
                        <label class="block text-gray-700 font-medium mb-1">Your Name <span class="text-red-500">*</span></label>
                        <input type="text" id="contrib-name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="Jane Doe" required>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-medium mb-1">Amount Sent (KES) <span class="text-gray-400 font-normal text-sm">optional</span></label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">KES</span>
                            <input type="number" id="contrib-amount" step="1" min="1" class="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="0">
                        </div>
                        <div class="flex gap-2 mt-2 flex-wrap">
                            <button type="button" onclick="setContribAmount(100)"  class="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs hover:bg-purple-100">100</button>
                            <button type="button" onclick="setContribAmount(500)"  class="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs hover:bg-purple-100">500</button>
                            <button type="button" onclick="setContribAmount(1000)" class="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs hover:bg-purple-100">1,000</button>
                            <button type="button" onclick="setContribAmount(2000)" class="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs hover:bg-purple-100">2,000</button>
                            <button type="button" onclick="setContribAmount(5000)" class="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs hover:bg-purple-100">5,000</button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-medium mb-1">Message / Note <span class="text-gray-400 font-normal text-sm">optional</span></label>
                        <textarea id="contrib-message" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent" placeholder="Happy birthday! 🎉"></textarea>
                    </div>
                </div>

                <div id="contrib-error" class="mt-3 p-3 bg-red-100 text-red-700 rounded-lg text-sm" style="display:none;"></div>
                <div id="contrib-success" class="mt-3 p-3 bg-green-100 text-green-700 rounded-lg text-sm" style="display:none;">
                    <i class="fas fa-check-circle mr-1"></i>Thank you! Your contribution has been recorded.
                </div>

                <button onclick="submitContribution()" id="contrib-submit-btn"
                    class="w-full mt-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg transition-all">
                    <i class="fas fa-paper-plane mr-2"></i>Submit Contribution
                </button>
            </div>
        </div>

        <!-- Share Modal -->
        <div id="share-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4" onclick="closeShareModal(event)">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Share This Event</h3>
                    <button onclick="closeShareModal()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>
                <div class="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                    <input type="text" id="share-url" readonly class="flex-1 bg-transparent text-gray-700 text-sm outline-none">
                    <button onclick="copyShareUrl()" class="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">Copy</button>
                </div>
                <div class="grid grid-cols-4 gap-3">
                    <button onclick="shareWA()"  class="flex flex-col items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg"><i class="fab fa-whatsapp text-2xl text-green-600"></i><span class="text-xs mt-1 text-gray-600">WhatsApp</span></button>
                    <button onclick="shareFB()"  class="flex flex-col items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg"><i class="fab fa-facebook text-2xl text-blue-600"></i><span class="text-xs mt-1 text-gray-600">Facebook</span></button>
                    <button onclick="shareTW()"  class="flex flex-col items-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg"><i class="fab fa-twitter text-2xl text-sky-600"></i><span class="text-xs mt-1 text-gray-600">Twitter</span></button>
                    <button onclick="shareTG()"  class="flex flex-col items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg"><i class="fab fa-telegram text-2xl text-blue-500"></i><span class="text-xs mt-1 text-gray-600">Telegram</span></button>
                    <button onclick="shareEM()"  class="flex flex-col items-center p-3 bg-red-50 hover:bg-red-100 rounded-lg"><i class="fas fa-envelope text-2xl text-red-600"></i><span class="text-xs mt-1 text-gray-600">Email</span></button>
                    <button onclick="shareLI()"  class="flex flex-col items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg"><i class="fab fa-linkedin text-2xl text-blue-700"></i><span class="text-xs mt-1 text-gray-600">LinkedIn</span></button>
                    <button onclick="shareSMS()" class="flex flex-col items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg"><i class="fas fa-sms text-2xl text-green-600"></i><span class="text-xs mt-1 text-gray-600">SMS</span></button>
                    <button onclick="shareNative()" class="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg"><i class="fas fa-share-nodes text-2xl text-gray-600"></i><span class="text-xs mt-1 text-gray-600">More</span></button>
                </div>
                <div id="share-copy-ok" class="text-center text-green-600 font-medium mt-3 text-sm" style="display:none;"><i class="fas fa-check-circle mr-1"></i>Link copied!</div>
            </div>
        </div>

        <script>
            const shareableLink = '${shareableLink}';
            let eventId = null;
            let eventData = null;

            // ── Safe HTML escaping (prevents XSS & JS syntax errors) ───────
            function h(str) {
                if (str == null) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            // ── Load event ─────────────────────────────────────────────────
            async function loadEvent() {
                try {
                    const response = await axios.get('/api/events/' + shareableLink);
                    const { event, messages, contributions } = response.data;
                    eventId   = event.id;
                    eventData = event;
                    document.title = h(event.title) + ' - Upsend';

                    // Build images HTML
                    let imagesHTML = '';
                    if (event.images && event.images.length > 0) {
                        let slides = event.images.map((img, i) =>
                            '<img src="' + h(img.image_url) + '" class="w-full h-full object-cover flex-shrink-0" alt="Event image ' + (i+1) + '">'
                        ).join('');
                        let dots = event.images.length > 1 ? event.images.map((_, i) =>
                            '<button data-slide-index="' + i + '" class="slide-dot w-2 h-2 rounded-full bg-white ' + (i===0?'bg-opacity-100':'bg-opacity-50') + ' transition-all"></button>'
                        ).join('') : '';
                        let nav = event.images.length > 1
                            ? '<button id="prev-slide-btn" class="absolute left-3 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all"><i class="fas fa-chevron-left"></i></button>'
                            + '<button id="next-slide-btn" class="absolute right-3 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all"><i class="fas fa-chevron-right"></i></button>'
                            + '<div id="slide-indicators" class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">' + dots + '</div>'
                            : '';
                        imagesHTML = '<div class="relative w-full h-64 md:h-96 bg-gray-900 overflow-hidden"><div id="slideshow-container" class="flex transition-transform duration-500 ease-out h-full">' + slides + '</div>' + nav + '</div>';
                    } else if (event.cover_image) {
                        imagesHTML = '<img src="' + h(event.cover_image) + '" class="w-full h-64 md:h-96 object-cover">';
                    } else {
                        imagesHTML = '<div class="w-full h-64 bg-gradient-to-br from-purple-400 to-pink-400"></div>';
                    }

                    // Build payment instructions HTML
                    const paymentHTML = buildPaymentHTML(event);

                    // Build contributions list HTML
                    const contribsHTML = buildContributionsHTML(contributions);

                    // ── Render page using safe string concatenation ─────────
                    const dateStr = new Date(event.event_date).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
                    const descHTML = event.description
                        ? '<p class="text-gray-700 text-lg mb-4 whitespace-pre-line">' + h(event.description) + '</p>'
                        : '';

                    const messagesHTML = messages.length === 0
                        ? '<p class="text-gray-500 text-center py-6">No messages yet. Be the first!</p>'
                        : messages.map(m =>
                            '<div class="bg-gray-50 rounded-lg p-4">' +
                            '<p class="font-semibold text-gray-800 text-sm mb-1">' + h(m.user_name || 'Anonymous') + '</p>' +
                            '<p class="text-gray-700 text-sm">' + h(m.message_text) + '</p>' +
                            '</div>'
                          ).join('');

                    document.getElementById('event-content').innerHTML =
                        '<!-- Event card -->' +
                        '<div class="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">' +
                            imagesHTML +
                            '<div class="p-6 md:p-8">' +
                                '<h1 class="text-3xl md:text-4xl font-bold text-gray-800 mb-2">' + h(event.title) + '</h1>' +
                                '<p class="text-gray-600 mb-3"><i class="far fa-calendar mr-2"></i>' + h(dateStr) + '</p>' +
                                descHTML +
                                '<p class="text-sm text-gray-400">Organised by <span class="font-medium text-gray-600">' + h(event.creator_name) + '</span></p>' +
                            '</div>' +
                        '</div>' +

                        '<!-- Payment + Message grid -->' +
                        '<div class="grid md:grid-cols-2 gap-6 mb-8">' +

                            paymentHTML +

                            '<!-- Leave a message -->' +
                            '<div class="bg-white rounded-xl shadow-lg p-6">' +
                                '<h2 class="text-xl font-bold text-gray-800 mb-4"><i class="far fa-comment-dots mr-2 text-purple-600"></i>Leave a Message</h2>' +
                                '<form id="message-form">' +
                                    '<div class="mb-3">' +
                                        '<label class="block text-gray-700 font-medium mb-1 text-sm">Your Name (optional)</label>' +
                                        '<input type="text" id="user_name" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm" placeholder="Anonymous">' +
                                    '</div>' +
                                    '<div class="mb-3">' +
                                        '<label class="block text-gray-700 font-medium mb-1 text-sm">Message <span class="text-red-500">*</span></label>' +
                                        '<textarea id="message_text" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm" placeholder="Share your thoughts\u2026" required></textarea>' +
                                    '</div>' +
                                    '<button type="submit" class="w-full bg-purple-600 text-white font-semibold py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-sm">' +
                                        '<i class="fas fa-paper-plane mr-1"></i>Send Message' +
                                    '</button>' +
                                '</form>' +
                                '<div id="message-success" class="mt-3 p-3 bg-green-100 text-green-700 rounded-lg text-sm" style="display:none;">' +
                                    '<i class="fas fa-check-circle mr-1"></i>Message sent!' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        '<!-- Messages list -->' +
                        '<div class="bg-white rounded-xl shadow-lg p-6 mb-8">' +
                            '<h2 class="text-xl font-bold text-gray-800 mb-5"><i class="fas fa-comments mr-2 text-blue-600"></i>Messages (' + messages.length + ')</h2>' +
                            '<div id="messages-list" class="space-y-3">' + messagesHTML + '</div>' +
                        '</div>' +

                        '<!-- Contributions list (public) -->' +
                        '<div class="bg-white rounded-xl shadow-lg p-6 mb-8" id="public-contributions-wrap">' +
                            '<h2 class="text-xl font-bold text-gray-800 mb-5"><i class="fas fa-hand-holding-heart mr-2 text-pink-600"></i>Contributors</h2>' +
                            '<div id="public-contributions-list">' + contribsHTML + '</div>' +
                        '</div>' +

                        '<!-- Share button -->' +
                        '<div class="text-center">' +
                            '<button onclick="openShareModal()" class="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:shadow-xl transition-all">' +
                                '<i class="fas fa-share-alt mr-2"></i>Share This Event' +
                            '</button>' +
                        '</div>';

                    // Set share URL
                    document.getElementById('share-url').value = window.location.href;

                    // Form handlers
                    document.getElementById('message-form').addEventListener('submit', submitMessage);

                    // Init slideshow
                    if (typeof window.initSlideshow === 'function') setTimeout(window.initSlideshow, 100);
                } catch (error) {
                    document.getElementById('event-content').innerHTML =
                        '<div class="text-center py-12"><div class="text-red-600 text-lg mb-4">Event not found</div><a href="/" class="text-purple-600 hover:text-purple-700">Go to homepage</a></div>';
                }
            }

            // ── Payment instructions builder ───────────────────────────────
            function copyText(text, btnId) {
                navigator.clipboard.writeText(text).then(() => {
                    const btn = document.getElementById(btnId);
                    if (btn) {
                        const orig = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
                        btn.classList.add('bg-green-500');
                        btn.classList.remove('bg-gray-700','hover:bg-gray-800');
                        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('bg-green-500'); btn.classList.add('bg-gray-700','hover:bg-gray-800'); }, 2000);
                    }
                });
            }

            // Store payment values for copy buttons (avoids injection in onclick)
            let _paymentCopyValues = {};
            function copyPaymentValue(key) { copyText(_paymentCopyValues[key] || '', 'copy-' + key + '-btn'); }

            function buildPaymentHTML(event) {
                const method = event.payment_method;
                if (!method) return '';

                // Store values safely for copy buttons
                _paymentCopyValues = {
                    phone:   event.payment_phone   || '',
                    paybill: event.payment_paybill || '',
                    account: event.payment_account || '',
                    till:    event.payment_till    || '',
                };

                const bannerHTML = '<div class="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"><i class="fas fa-info-circle text-amber-500 shrink-0"></i><p class="text-amber-800 text-xs">Payments go <strong>directly to the event organiser</strong>. Upsend does not handle your money.</p></div>';

                const howToHTML = '<div class="mt-4 bg-purple-50 border border-purple-100 rounded-lg p-4"><p class="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">How to contribute</p><ol class="text-xs text-gray-700 space-y-1 list-decimal list-inside"><li>Send money using the details above</li><li>Click <strong>"I Have Contributed"</strong> below</li><li>Leave a message (optional)</li></ol></div>';

                const iHaveContribBtn = '<button onclick="openContributionModal()" class="w-full mt-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"><i class="fas fa-check-circle"></i>I Have Contributed</button>';

                let inner = '';

                if (method === 'mpesa_phone') {
                    inner = '<div class="space-y-3">' +
                        '<p class="text-sm font-semibold text-gray-600 uppercase tracking-wide"><i class="fas fa-mobile-alt mr-2 text-green-600"></i>M-Pesa \u2014 Send Money</p>' +
                        '<div class="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">' +
                            '<div class="flex items-center justify-between"><div><p class="text-xs text-gray-500">Phone Number</p><p class="text-xl font-bold text-gray-800">' + h(event.payment_phone) + '</p></div>' +
                            '<button id="copy-phone-btn" onclick="copyPaymentValue(&quot;phone&quot;)" class="copy-btn px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs transition-colors"><i class="fas fa-copy mr-1"></i>Copy</button></div>' +
                            (event.payment_name ? '<p class="text-sm text-gray-600">Name: <span class="font-semibold">' + h(event.payment_name) + '</span></p>' : '') +
                        '</div>' +
                    '</div>';
                } else if (method === 'mpesa_paybill') {
                    inner = '<div class="space-y-3">' +
                        '<p class="text-sm font-semibold text-gray-600 uppercase tracking-wide"><i class="fas fa-building mr-2 text-green-600"></i>M-Pesa \u2014 Paybill</p>' +
                        '<div class="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">' +
                            '<div class="flex items-center justify-between"><div><p class="text-xs text-gray-500">Business Number</p><p class="text-2xl font-bold text-gray-800">' + h(event.payment_paybill) + '</p></div>' +
                            '<button id="copy-paybill-btn" onclick="copyPaymentValue(&quot;paybill&quot;)" class="copy-btn px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs transition-colors"><i class="fas fa-copy mr-1"></i>Copy</button></div>' +
                            (event.payment_account ? '<div class="flex items-center justify-between"><div><p class="text-xs text-gray-500">Account Number</p><p class="text-xl font-bold text-gray-800">' + h(event.payment_account) + '</p></div>' +
                            '<button id="copy-account-btn" onclick="copyPaymentValue(&quot;account&quot;)" class="copy-btn px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs transition-colors"><i class="fas fa-copy mr-1"></i>Copy</button></div>' : '') +
                        '</div>' +
                    '</div>';
                } else if (method === 'mpesa_till') {
                    inner = '<div class="space-y-3">' +
                        '<p class="text-sm font-semibold text-gray-600 uppercase tracking-wide"><i class="fas fa-store mr-2 text-green-600"></i>M-Pesa \u2014 Buy Goods (Till)</p>' +
                        '<div class="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">' +
                            '<div class="flex items-center justify-between"><div><p class="text-xs text-gray-500">Till Number</p><p class="text-2xl font-bold text-gray-800">' + h(event.payment_till) + '</p></div>' +
                            '<button id="copy-till-btn" onclick="copyPaymentValue(&quot;till&quot;)" class="copy-btn px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs transition-colors"><i class="fas fa-copy mr-1"></i>Copy</button></div>' +
                            (event.payment_name ? '<p class="text-sm text-gray-600">Name: <span class="font-semibold">' + h(event.payment_name) + '</span></p>' : '') +
                        '</div>' +
                    '</div>';
                } else if (method === 'bank_transfer') {
                    inner = '<div class="space-y-3">' +
                        '<p class="text-sm font-semibold text-gray-600 uppercase tracking-wide"><i class="fas fa-university mr-2 text-blue-600"></i>Bank Transfer</p>' +
                        '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
                            '<pre class="text-sm text-gray-700 whitespace-pre-wrap font-sans">' + h(event.payment_account) + '</pre>' +
                        '</div>' +
                    '</div>';
                } else if (method === 'external_link') {
                    inner = '<div class="space-y-3">' +
                        '<p class="text-sm font-semibold text-gray-600 uppercase tracking-wide"><i class="fas fa-link mr-2 text-purple-600"></i>Online Payment</p>' +
                        '<a href="' + h(event.payment_link || '#') + '" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all">' +
                            '<i class="fas fa-external-link-alt"></i>Click Here to Contribute' +
                        '</a>' +
                    '</div>';
                }

                return '<div class="bg-white rounded-xl shadow-lg p-6">' +
                    '<h2 class="text-xl font-bold text-gray-800 mb-4"><i class="fas fa-hand-holding-usd mr-2 text-green-600"></i>Make a Contribution</h2>' +
                    inner + bannerHTML + howToHTML + iHaveContribBtn +
                '</div>';
            }

            // ── Contributions list builder ──────────────────────────────────
            function buildContributionsHTML(contributions) {
                if (!contributions || contributions.length === 0) {
                    return '<p class="text-gray-500 text-center py-6 text-sm">No contributions recorded yet. Be the first!</p>';
                }
                return '<div class="space-y-2">' + contributions.map(c =>
                    '<div class="flex items-start justify-between bg-gray-50 rounded-lg px-4 py-3">' +
                        '<div><p class="font-semibold text-gray-800 text-sm">' + h(c.contributor_name || 'Anonymous') + '</p>' +
                        (c.message ? '<p class="text-xs text-gray-500 italic mt-0.5">' + h(c.message) + '</p>' : '') +
                        '</div>' +
                        (c.amount ? '<span class="text-sm font-bold text-green-600 shrink-0 ml-3">KES ' + parseFloat(c.amount).toFixed(0) + '</span>' : '') +
                    '</div>'
                ).join('') + '</div>';
            }

            // ── Message submit ──────────────────────────────────────────────
            async function submitMessage(e) {
                e.preventDefault();
                const user_name    = document.getElementById('user_name').value;
                const message_text = document.getElementById('message_text').value;
                try {
                    await axios.post('/api/messages/create', { event_id: eventId, user_name: user_name || undefined, message_text });
                    document.getElementById('message-success').style.display = 'block';
                    document.getElementById('message-form').reset();
                    setTimeout(() => { document.getElementById('message-success').style.display = 'none'; loadEvent(); }, 2000);
                } catch { alert('Failed to send message'); }
            }

            // ── Contribution modal ──────────────────────────────────────────
            function openContributionModal() {
                document.getElementById('contribution-modal').classList.remove('hidden');
                document.getElementById('contribution-modal').classList.add('flex');
                document.getElementById('contrib-name').focus();
                document.getElementById('contrib-error').style.display   = 'none';
                document.getElementById('contrib-success').style.display = 'none';
            }

            function closeContributionModal(e) {
                if (!e || e.target.id === 'contribution-modal') {
                    document.getElementById('contribution-modal').classList.add('hidden');
                    document.getElementById('contribution-modal').classList.remove('flex');
                }
            }

            function setContribAmount(val) { document.getElementById('contrib-amount').value = val; }

            async function submitContribution() {
                const name    = document.getElementById('contrib-name').value.trim();
                const amount  = document.getElementById('contrib-amount').value;
                const message = document.getElementById('contrib-message').value.trim();
                const errDiv  = document.getElementById('contrib-error');
                const okDiv   = document.getElementById('contrib-success');
                const btn     = document.getElementById('contrib-submit-btn');

                errDiv.style.display = 'none';
                okDiv.style.display  = 'none';

                if (!name) { errDiv.textContent = 'Please enter your name.'; errDiv.style.display = 'block'; return; }

                btn.disabled  = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting…';

                try {
                    await axios.post('/api/contributions', {
                        event_id: eventId,
                        name,
                        amount: amount ? parseFloat(amount) : undefined,
                        message: message || undefined,
                    });
                    okDiv.style.display = 'block';
                    document.getElementById('contrib-name').value    = '';
                    document.getElementById('contrib-amount').value  = '';
                    document.getElementById('contrib-message').value = '';

                    // Refresh contributions list
                    setTimeout(async () => {
                        closeContributionModal();
                        const res = await axios.get('/api/events/' + shareableLink);
                        const panel = document.getElementById('public-contributions-list');
                        if (panel) panel.innerHTML = buildContributionsHTML(res.data.contributions);
                    }, 1800);
                } catch (err) {
                    errDiv.textContent = err.response?.data?.error || 'Failed to submit. Please try again.';
                    errDiv.style.display = 'block';
                } finally {
                    btn.disabled  = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Contribution';
                }
            }

            // ── Share modal ────────────────────────────────────────────────
            function openShareModal()  { document.getElementById('share-modal').classList.remove('hidden'); document.getElementById('share-modal').classList.add('flex'); }
            function closeShareModal(e) { if (!e || e.target.id === 'share-modal') { document.getElementById('share-modal').classList.add('hidden'); document.getElementById('share-modal').classList.remove('flex'); } }
            function copyShareUrl() { navigator.clipboard.writeText(window.location.href).then(() => { document.getElementById('share-copy-ok').style.display='block'; setTimeout(()=>document.getElementById('share-copy-ok').style.display='none',2500); }); }
            function shareWA()  { window.open('https://wa.me/?text=' + encodeURIComponent(document.title + ' ' + window.location.href), '_blank'); }
            function shareFB()  { window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href), '_blank'); }
            function shareTW()  { window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(window.location.href) + '&text=' + encodeURIComponent(document.title), '_blank'); }
            function shareTG()  { window.open('https://t.me/share/url?url=' + encodeURIComponent(window.location.href), '_blank'); }
            function shareEM()  { window.location.href = 'mailto:?subject=' + encodeURIComponent(document.title) + '&body=' + encodeURIComponent(window.location.href); }
            function shareLI()  { window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(window.location.href), '_blank'); }
            function shareSMS() { window.location.href = 'sms:?body=' + encodeURIComponent(document.title + ' ' + window.location.href); }
            function shareNative() { if (navigator.share) { navigator.share({ title: document.title, url: window.location.href }).catch(()=>{}); } else { copyShareUrl(); } }

            loadEvent();
        </script>
    </body>
    </html>
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT DETAILS PAGE (creator)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/event-details/:eventId', (c) => {
  const eventId = c.req.param('eventId');

  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Details - Upsend</title>
        ${PWA_META_TAGS}
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
            .new-row { animation: slideIn 0.35s ease-out; }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <nav class="bg-white shadow-sm">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <a href="/dashboard" class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Upsend</a>
                    <a href="/dashboard" class="text-gray-600 hover:text-gray-800 text-sm"><i class="fas fa-arrow-left mr-2"></i>Dashboard</a>
                </div>
            </div>
        </nav>

        <!-- Toast -->
        <div id="toast" class="fixed top-4 right-4 z-50 hidden">
            <div id="toast-inner" class="bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold">
                <i class="fas fa-check-circle"></i><span id="toast-msg">Updated</span>
            </div>
        </div>

        <div class="container mx-auto px-4 py-8">
            <div class="max-w-6xl mx-auto" id="event-details">
                <div class="text-center py-12"><div class="text-gray-400 text-lg">Loading…</div></div>
            </div>
        </div>

        <!-- Share modal -->
        <div id="share-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4" onclick="closeShareModal(event)">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Share This Event</h3>
                    <button onclick="closeShareModal()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>
                <div class="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                    <input type="text" id="share-url" readonly class="flex-1 bg-transparent text-gray-700 text-sm outline-none">
                    <button onclick="copyShareUrl()" class="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">Copy</button>
                </div>
                <div class="grid grid-cols-4 gap-3">
                    <button onclick="shareWA()"  class="flex flex-col items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg"><i class="fab fa-whatsapp text-2xl text-green-600"></i><span class="text-xs mt-1 text-gray-600">WhatsApp</span></button>
                    <button onclick="shareFB()"  class="flex flex-col items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg"><i class="fab fa-facebook text-2xl text-blue-600"></i><span class="text-xs mt-1 text-gray-600">Facebook</span></button>
                    <button onclick="shareTW()"  class="flex flex-col items-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg"><i class="fab fa-twitter text-2xl text-sky-600"></i><span class="text-xs mt-1 text-gray-600">Twitter</span></button>
                    <button onclick="shareTG()"  class="flex flex-col items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg"><i class="fab fa-telegram text-2xl text-blue-500"></i><span class="text-xs mt-1 text-gray-600">Telegram</span></button>
                </div>
                <div id="share-copy-ok" class="text-center text-green-600 font-medium mt-3 text-sm" style="display:none;"><i class="fas fa-check-circle mr-1"></i>Link copied!</div>
            </div>
        </div>

        <script>
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('session_token');
            const eventId = '${eventId}';
            let shareableLink = '';
            let eventTitle = '';
            let lastContribCount = 0;
            let pageReady = false;

            // ── Toast ──────────────────────────────────────────────────────
            function showToast(msg, color) {
                color = color || 'green';
                const t = document.getElementById('toast');
                const ti = document.getElementById('toast-inner');
                document.getElementById('toast-msg').textContent = msg;
                ti.className = 'bg-' + color + '-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold';
                t.classList.remove('hidden');
                setTimeout(() => t.classList.add('hidden'), 3000);
            }

            // ── Safe HTML escape helper (also used in event-details) ───────
            function hd(str) {
                if (str == null) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            // ── Render contributions panel ─────────────────────────────────
            function renderContributions(contributions, total) {
                const panel = document.getElementById('contributions-panel');
                const cntEl = document.getElementById('stat-contributions');
                const totEl = document.getElementById('stat-total');
                if (cntEl) cntEl.textContent = contributions.length;
                if (totEl) totEl.textContent = 'KES ' + parseFloat(total || 0).toFixed(2);

                if (pageReady && contributions.length > lastContribCount) {
                    const diff = contributions.length - lastContribCount;
                    showToast(diff + ' new contribution' + (diff>1?'s':'') + ' received!');
                }
                lastContribCount = contributions.length;
                if (!panel) return;

                if (contributions.length === 0) {
                    panel.innerHTML = '<p class="text-gray-500 text-center py-8 text-sm">No contributions recorded yet</p>';
                    return;
                }

                panel.innerHTML = contributions.map((c, i) => {
                    const isNew = pageReady && i === 0;
                    return '<div class="rounded-lg p-4 border border-gray-100 bg-white ' + (isNew ? 'new-row border-green-200' : '') + '">' +
                        '<div class="flex items-start justify-between">' +
                            '<div class="flex-1 min-w-0">' +
                                '<p class="font-semibold text-gray-800 text-sm">' + hd(c.contributor_name || 'Anonymous') + '</p>' +
                                (c.message ? '<p class="text-xs text-gray-500 italic mt-0.5 line-clamp-2">' + hd(c.message) + '</p>' : '') +
                                '<p class="text-xs text-gray-400 mt-1">' + new Date(c.created_at * 1000).toLocaleString() + '</p>' +
                            '</div>' +
                            (c.amount ? '<span class="text-base font-bold text-green-600 ml-3 shrink-0">KES ' + parseFloat(c.amount).toFixed(0) + '</span>' : '<span class="text-xs text-gray-400 ml-3 shrink-0 italic">no amount</span>') +
                        '</div>' +
                    '</div>';
                }).join('');
            }

            // ── Refresh contributions (silent background poll) ─────────────
            async function refreshContributions(silent) {
                const btn = document.getElementById('refresh-btn');
                if (btn && !silent) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i>Refreshing…'; }
                try {
                    const r = await axios.get('/api/events/creator/' + eventId);
                    renderContributions(r.data.contributions, r.data.total_contributions);
                    if (!silent) showToast('Contributions refreshed', 'blue');
                } catch (err) {
                    if (!silent) showToast('Refresh failed', 'red');
                } finally {
                    if (btn && !silent) { btn.disabled=false; btn.innerHTML='<i class="fas fa-sync-alt mr-1"></i>Refresh'; }
                }
            }

            // ── Full initial page load ─────────────────────────────────────
            async function loadEventDetails() {
                try {
                    const r = await axios.get('/api/events/creator/' + eventId);
                    const { event, messages, contributions, total_contributions } = r.data;
                    shareableLink = event.shareable_link;
                    eventTitle    = event.title;
                    lastContribCount = contributions.length;

                    document.title = event.title + ' – Upsend';
                    document.getElementById('share-url').value = window.location.origin + '/event/' + event.shareable_link;

                    const msgsHTML = messages.length === 0
                        ? '<p class="text-gray-500 text-center py-8 text-sm">No messages yet</p>'
                        : messages.map(m =>
                            '<div class="bg-gray-50 rounded-lg p-3">' +
                            '<p class="font-semibold text-gray-800 text-sm mb-0.5">' + hd(m.user_name || 'Anonymous') + '</p>' +
                            '<p class="text-gray-700 text-sm">' + hd(m.message_text) + '</p>' +
                            '<p class="text-xs text-gray-400 mt-1">' + new Date(m.created_at * 1000).toLocaleString() + '</p>' +
                            '</div>'
                          ).join('');

                    const paymentBadge = event.payment_method
                        ? '<div class="mb-6 bg-white rounded-xl shadow p-4 flex items-center gap-3">' +
                          '<i class="fas fa-money-bill-wave text-green-500 text-lg"></i>' +
                          '<div><p class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Payment Method</p>' +
                          '<p class="font-semibold text-gray-800">' + hd(formatPaymentMethod(event)) + '</p></div></div>'
                        : '';

                    document.getElementById('event-details').innerHTML =
                        '<div class="mb-8">' +
                            '<div class="flex flex-wrap justify-between items-start gap-3 mb-6">' +
                                '<div>' +
                                    '<h2 class="text-3xl font-bold text-gray-800 mb-1">' + hd(event.title) + '</h2>' +
                                    '<p class="text-gray-500 text-sm"><i class="far fa-calendar mr-2"></i>' + new Date(event.event_date).toLocaleDateString() + '</p>' +
                                '</div>' +
                                '<div class="flex gap-2 flex-wrap">' +
                                    '<a href="/event/' + hd(event.shareable_link) + '" target="_blank" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">' +
                                        '<i class="fas fa-external-link-alt mr-1"></i>Public Page' +
                                    '</a>' +
                                    '<button onclick="openShareModal()" class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm hover:shadow-lg transition-all">' +
                                        '<i class="fas fa-share-alt mr-1"></i>Share' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +

                            '<div class="grid grid-cols-3 gap-3 mb-8">' +
                                '<div class="bg-white rounded-xl shadow p-4 text-center">' +
                                    '<div id="stat-messages" class="text-2xl sm:text-3xl font-bold text-purple-600">' + messages.length + '</div>' +
                                    '<div class="text-xs sm:text-sm text-gray-600 mt-1">Messages</div>' +
                                '</div>' +
                                '<div class="bg-white rounded-xl shadow p-4 text-center">' +
                                    '<div id="stat-contributions" class="text-2xl sm:text-3xl font-bold text-pink-600">' + contributions.length + '</div>' +
                                    '<div class="text-xs sm:text-sm text-gray-600 mt-1">Contributions</div>' +
                                '</div>' +
                                '<div class="bg-white rounded-xl shadow p-4 text-center">' +
                                    '<div id="stat-total" class="text-base sm:text-2xl font-bold text-green-600 break-all">KES ' + parseFloat(total_contributions || 0).toFixed(2) + '</div>' +
                                    '<div class="text-xs sm:text-sm text-gray-600 mt-1">Total</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        paymentBadge +

                        '<div class="grid md:grid-cols-2 gap-6">' +
                            '<div class="bg-white rounded-xl shadow-lg p-6">' +
                                '<h3 class="text-lg font-bold text-gray-800 mb-4"><i class="far fa-comment-dots mr-2 text-purple-600"></i>Messages</h3>' +
                                '<div class="space-y-3 max-h-96 overflow-y-auto">' + msgsHTML + '</div>' +
                            '</div>' +

                            '<div class="bg-white rounded-xl shadow-lg p-6">' +
                                '<div class="flex justify-between items-center mb-3">' +
                                    '<h3 class="text-lg font-bold text-gray-800"><i class="fas fa-hand-holding-heart mr-2 text-pink-600"></i>Contributions</h3>' +
                                    '<button id="refresh-btn" onclick="refreshContributions(false)"' +
                                        ' class="flex items-center gap-1 px-3 py-1.5 bg-pink-50 text-pink-700 border border-pink-200 rounded-lg text-xs hover:bg-pink-100 transition-colors">' +
                                        '<i class="fas fa-sync-alt mr-1"></i>Refresh' +
                                    '</button>' +
                                '</div>' +
                                '<p id="last-refreshed" class="text-xs text-gray-400 mb-3">Auto-refreshes every 30s</p>' +
                                '<div class="space-y-2 max-h-[500px] overflow-y-auto" id="contributions-panel"></div>' +
                            '</div>' +
                        '</div>';

                    renderContributions(contributions, total_contributions);
                    pageReady = true;

                    // Auto-refresh every 30s for up to 10 minutes
                    let count = 0;
                    function autoRefresh() {
                        setTimeout(async () => {
                            count++;
                            await refreshContributions(true);
                            const el = document.getElementById('last-refreshed');
                            if (el) el.textContent = 'Last refreshed: ' + new Date().toLocaleTimeString();
                            if (count < 20) autoRefresh();
                            else if (el) el.textContent = 'Auto-refresh stopped. Click Refresh to update.';
                        }, 30000);
                    }
                    autoRefresh();

                } catch {
                    document.getElementById('event-details').innerHTML =
                        '<div class="text-center py-12"><div class="text-red-600 text-lg mb-4">Failed to load event</div><a href="/dashboard" class="text-purple-600">Back to Dashboard</a></div>';
                }
            }

            function formatPaymentMethod(event) {
                const labels = { mpesa_phone:'M-Pesa Send Money', mpesa_paybill:'M-Pesa Paybill', mpesa_till:'M-Pesa Till', bank_transfer:'Bank Transfer', external_link:'External Link' };
                let detail = '';
                if (event.payment_method === 'mpesa_phone' && event.payment_phone) detail = ' · ' + event.payment_phone;
                if (event.payment_method === 'mpesa_paybill' && event.payment_paybill) detail = ' · ' + event.payment_paybill;
                if (event.payment_method === 'mpesa_till' && event.payment_till) detail = ' · ' + event.payment_till;
                return (labels[event.payment_method] || event.payment_method) + detail;
            }

            // ── Share modal ────────────────────────────────────────────────
            function openShareModal()  { document.getElementById('share-modal').classList.remove('hidden'); document.getElementById('share-modal').classList.add('flex'); }
            function closeShareModal(e) { if (!e || e.target.id==='share-modal') { document.getElementById('share-modal').classList.add('hidden'); document.getElementById('share-modal').classList.remove('flex'); } }
            function copyShareUrl() { navigator.clipboard.writeText(window.location.origin+'/event/'+shareableLink).then(()=>{ document.getElementById('share-copy-ok').style.display='block'; setTimeout(()=>document.getElementById('share-copy-ok').style.display='none',2500); }); }
            function shareWA()  { window.open('https://wa.me/?text='+encodeURIComponent(eventTitle+' '+window.location.origin+'/event/'+shareableLink),'_blank'); }
            function shareFB()  { window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(window.location.origin+'/event/'+shareableLink),'_blank'); }
            function shareTW()  { window.open('https://twitter.com/intent/tweet?url='+encodeURIComponent(window.location.origin+'/event/'+shareableLink),'_blank'); }
            function shareTG()  { window.open('https://t.me/share/url?url='+encodeURIComponent(window.location.origin+'/event/'+shareableLink),'_blank'); }

            // ── Boot ──────────────────────────────────────────────────────
            axios.get('/api/auth/me')
                .then(() => loadEventDetails())
                .catch(() => window.location.href = '/auth');
        </script>
    </body>
    </html>
  `);
});

export default app;
