document.addEventListener('DOMContentLoaded', () => {
    const containerDiv = document.querySelector('.container');
    const titleDiv = containerDiv.querySelector('.d-flex');
    
    const searchSection = document.createElement('div');
    searchSection.className = 'row mb-4';
    searchSection.innerHTML = `
        <div class="col-md-6">
            <div class="input-group">
                <span class="input-group-text">
                    <i class="bi bi-search"></i>
                </span>
                <input type="text" class="form-control" id="searchPatients" 
                       placeholder="Search patients by name...">
            </div>
        </div>
        <div class="col-md-3">
            <select class="form-select" id="statusFilter">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="discharged">Discharged</option>
            </select>
        </div>
    `;

    titleDiv.insertAdjacentElement('afterend', searchSection);

    const searchInput = document.getElementById('searchPatients');
    const statusFilter = document.getElementById('statusFilter');
    const patientCards = document.querySelectorAll('.col-md-4');

    function filterPatients() {
        const searchTerm = searchInput.value.toLowerCase();
        const statusValue = statusFilter.value;

        patientCards.forEach(card => {
            const patientName = card.querySelector('.card-title').textContent.toLowerCase();
            const isDischarged = card.querySelector('.card').classList.contains('discharged');
            
            const matchesSearch = patientName.includes(searchTerm);
            const matchesStatus = 
                statusValue === 'all' || 
                (statusValue === 'active' && !isDischarged) || 
                (statusValue === 'discharged' && isDischarged);

            card.style.display = matchesSearch && matchesStatus ? '' : 'none';
        });
    }

    
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterPatients, 300);
    });

    statusFilter.addEventListener('change', filterPatients);

    
    patientCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.querySelector('.card').style.transform = 'translateY(-2px)';
            card.querySelector('.card').style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });

        card.addEventListener('mouseleave', () => {
            card.querySelector('.card').style.transform = 'none';
            card.querySelector('.card').style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
    });
});