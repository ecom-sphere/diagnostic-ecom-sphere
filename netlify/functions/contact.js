// Netlify Function - Proxy pour l'API systeme.io
// L'API key est stockee en variable d'environnement (pas dans le code)

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

        let contactId = null;

        // Etape 1 : Creer le contact (sans tags - l'API ne les supporte pas a la creation)
        const contactData = {
            email: email,
            fields: [{ slug: 'first_name', value: firstname }]
        };

        console.log('Creating contact:', email);
        const createRes = await fetch('https://api.systeme.io/api/contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(contactData)
        });

        if (createRes.status === 201 || createRes.status === 200) {
            const createData = await createRes.json();
            contactId = createData.id;
            console.log('Contact created, ID:', contactId);
        } else if (createRes.status === 422) {
            console.log('Contact already exists, searching...');
            const searchRes = await fetch(
                'https://api.systeme.io/api/contacts?email=' + encodeURIComponent(email),
                { headers: { 'X-API-Key': API_KEY } }
            );
            const searchData = await searchRes.json();
            if (searchData.items && searchData.items.length > 0) {
                contactId = searchData.items[0].id;
                console.log('Found existing contact, ID:', contactId);
            }
        } else {
            const errText = await createRes.text();
            console.error('Create contact error:', createRes.status, errText);
            throw new Error('Create contact failed: ' + createRes.status);
        }

        // Etape 2 : Ajouter les tags (appel separe - OBLIGATOIRE)
        if (contactId) {
            const tagsToAdd = ['quiz-diagnostic-ecom'];
            if (tag && tag !== 'quiz-diagnostic-ecom') {
                tagsToAdd.push(tag);
            }

            for (const tagName of tagsToAdd) {
                console.log('Adding tag ' + tagName + ' to contact ' + contactId);
                const tagRes = await fetch('https://api.systeme.io/api/contacts/' + contactId + '/tags', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEY
                    },
                    body: JSON.stringify({ name: tagName })
                });

                if (tagRes.ok) {
                    console.log('Tag ' + tagName + ' added successfully');
                } else {
                    const tagErr = await tagRes.text();
                    console.error('Tag ' + tagName + ' error:', tagRes.status, tagErr);
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, contactId: contactId, tags: tag })
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
