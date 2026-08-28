const socket = io();

socket.on('new_document', (doc) => {
    const tbody = document.getElementById('tableBody');
    if (tbody.children.length === 1 && tbody.children[0].innerText.includes('Koi document nahi mila')) {
        tbody.innerHTML = '';
    }

    const row = document.createElement('tr');
    row.className = 'new-row';
    row.innerHTML = `
        <td>${doc.id}</td>
        <td><b>${doc.user_id}</b></td>
        <td><span class="badge">${doc.doc_type}</span></td>
        <td>${doc.timestamp}</td>
        <td>${doc.file_path ? `<button class="btn-view" onclick="openModal('${doc.file_path}', '${doc.doc_type}')">👁️ View Document</button>` : 'No File'}</td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
});

async function searchDocs() {
    const query = document.getElementById('searchInput').value;
    try {
        const response = await fetch(`/api/documents?q=${query}`);
        const docs = await response.json();

        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #777;">Koi document nahi mila.</td></tr>';
            return;
        }

        docs.forEach(doc => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${doc.id}</td>
                <td><b>${doc.user_id}</b></td>
                <td><span class="badge">${doc.doc_type}</span></td>
                <td>${doc.timestamp}</td>
                <td>${doc.file_path ? `<button class="btn-view" onclick="openModal('${doc.file_path}', '${doc.doc_type}')">👁️ View Document</button>` : 'No File'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching docs:', error);
    }
}

function openModal(filePath, docType) {
    document.getElementById('modalTitle').innerText = `Document Preview: ${docType}`;
    document.getElementById('fileViewer').src = filePath;
    document.getElementById('docModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('docModal').style.display = 'none';
    document.getElementById('fileViewer').src = '';
}

searchDocs();