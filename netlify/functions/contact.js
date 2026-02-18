// Netlify Function - Proxy pour l'API systeme.io
// L'API key est stockée en variable d'environnement (pas dans le code)

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const API_KEY = process.env.SYSTEMEIO_API_KEY;

    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    try {
        const { email, firstname, tag } = JSON.parse(event.body);

        if (!email || !firstname) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and firstname required' }) };
        }

        // Créer le contact
        const contactData = {
            email: email,
            fields: [{ slug: 'first_name', value: firstname }],
            tags: [
                { name: 'quiz-diagnostic-ecom' },
                { name: tag || 'quiz-diagnostic-ecom' }
            ]
        };

        const response = await fetch('https://api.systeme.io/api/contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(contactData)
        });

        // Si le contact existe déjà (422), on ajoute le tag
        if (response.status === 422) {
            console.log('Contact existe déjà, ajout du tag...');

            const searchRes = await fetch(
                `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}`,
                { headers: { 'X-API-Key': API_KEY } }
            );
            const searchData = await searchRes.json();

            if (searchData.items && searchData.items[0]) {
                const contactId = searchData.items[0].id;

                await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEY
                    },
                    body: JSON.stringify({ tag: { name: tag } })
                });

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, message: 'Tag added to existing contact' })
                };
            }
        }

        if (!response.ok && response.status !== 422) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json().catch(() => ({}));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server error', message: error.message })
        };
    }
};
