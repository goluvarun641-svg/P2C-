document.getElementById('shareForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('userId').value;
    const docType = document.getElementById('docType').value;
    const fileInput = document.getElementById('docFile');
    const statusMsg = document.getElementById('statusMsg');

    if (fileInput.files.length === 0) {
        alert('Kripya file select karein!');
        return;
    }

    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('doc_type', docType);
    formData.append('document', fileInput.files[0]);

    statusMsg.style.display = 'block';
    statusMsg.className = 'status';
    statusMsg.innerText = 'Transmitting document safely...';

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            statusMsg.className = 'status success';
            statusMsg.innerText = '✅ Document Successfully Shared with Counter!';
            document.getElementById('shareForm').reset();
        } else {
            statusMsg.className = 'status error';
            statusMsg.innerText = '❌ Transfer Failed!';
        }
    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'status error';
        statusMsg.innerText = '❌ Network Error! Counter Server Connected Nahi Hai.';
    }
});