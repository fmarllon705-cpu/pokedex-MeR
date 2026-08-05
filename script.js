function renderCollection() {
  collectionGrid.innerHTML = "";
  if (!currentRawData) {
    collectionCount.textContent = "0";
    totalValueDisplay.textContent = "R$ 0,00";
    updateProgressBar(0);
    return;
  }

  const items = Object.entries(currentRawData);
  collectionCount.textContent = items.length;
  updateProgressBar(items.length);

  const totalValue = items.reduce((acc, [_, item]) => acc + (parseFloat(item.price) || 0), 0);
  totalValueDisplay.textContent = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const selectedSection = filterSection.value;
  const selectedSheet = parseInt(filterSheet.value, 10);
  const searchQuery = searchSaved.value.trim().toLowerCase();
  const currentSort = sortOrder.value;

  let filteredItems = items.filter(([key, item]) => {
    const matchSection = selectedSection === 'all' || item.section === selectedSection;
    const matchSheet = isNaN(selectedSheet) || item.location?.sheet === selectedSheet;
    const matchName = !searchQuery || item.name.toLowerCase().includes(searchQuery);
    return matchSection && matchSheet && matchName;
  });

  filteredItems.sort(([keyA, itemA], [keyB, itemB]) => {
    if (currentSort === 'price-desc') {
      return (parseFloat(itemB.price) || 0) - (parseFloat(itemA.price) || 0);
    } else if (currentSort === 'recent') {
      return new Date(itemB.addedAt || 0) - new Date(itemA.addedAt || 0);
    } else {
      return (itemA.location?.sheet || 0) - (itemB.location?.sheet || 0);
    }
  });

  filteredItems.forEach(([key, item]) => {
    const card = document.createElement('div');
    card.classList.add('poke-card-item');
    card.style.cursor = 'pointer';
    
    // Evento de clique para abrir o Pop-up/Modal
    card.addEventListener('click', (e) => {
      // Evita disparar se clicar no botão de remover direto no card
      if (e.target.closest('button')) return;
      openCardModal(key, item);
    });
    
    const shinyBadge = item.isShiny ? '<span class="position-absolute top-0 start-0 badge bg-warning text-dark m-1" style="font-size: 0.55rem;">✨</span>' : '';
    const langBadge = item.lang ? `<span class="badge bg-secondary me-1" style="font-size: 0.55rem;">${item.lang}</span>` : '';
    const condBadge = item.condition ? `<span class="badge bg-dark" style="font-size: 0.55rem;">${item.condition}</span>` : '';
    
    let finishBadge = '';
    if (item.finish === 'Holo') finishBadge = '<span class="badge bg-info text-dark d-block my-1" style="font-size: 0.55rem;">Holo ✨</span>';
    else if (item.finish === 'Reverse') finishBadge = '<span class="badge bg-primary d-block my-1" style="font-size: 0.55rem;">Reverse 🌟</span>';
    else if (item.finish === 'Ultra') finishBadge = '<span class="badge bg-danger d-block my-1" style="font-size: 0.55rem;">Ultra 💎</span>';

    const numDisplay = item.cardNumber ? `<small class="d-block card-number-text" style="font-size: 0.65rem;">№ ${item.cardNumber}</small>` : '';
    const priceDisplay = item.price ? `<span class="d-block text-success fw-bold mt-1" style="font-size: 0.7rem;">R$ ${parseFloat(item.price).toFixed(2)}</span>` : '';

    card.innerHTML = `
      ${shinyBadge}
      <button class="btn btn-sm text-danger position-absolute top-0 end-0 p-0 me-1 mt-1" onclick="removePokemon('${key}')" style="font-size: 0.8rem;" title="Remover">
        <i class="fa-solid fa-circle-xmark"></i>
      </button>
      <img src="${item.image}" alt="${item.name}">
      <span class="d-block text-capitalize fw-bold text-truncate small mt-1">${item.name}</span>
      ${numDisplay}
      ${finishBadge}
      <div class="my-1">${langBadge}${condBadge}</div>
      ${priceDisplay}
      <span class="badge bg-warning text-dark w-100 mt-1" style="font-size: 0.6rem;">F:${item.location.sheet} | ${item.location.side[0]} | B:${item.location.pocket}</span>
    `;
    collectionGrid.appendChild(card);
  });
}

// Função para popular e abrir o Modal com os dados da carta
function openCardModal(key, item) {
  document.getElementById('modalCardTitle').textContent = `${item.name} ${item.isShiny ? '✨' : ''}`;
  document.getElementById('modalCardImg').src = item.image;
  document.getElementById('modalCardSet').textContent = item.setName || 'Desconhecida';
  document.getElementById('modalCardNumber').textContent = item.cardNumber || '---';
  document.getElementById('modalCardLang').textContent = item.lang || 'PT-BR';
  document.getElementById('modalCardCondition').textContent = item.condition || 'NM';
  document.getElementById('modalCardFinish').textContent = item.finish || 'Normal';
  document.getElementById('modalCardPrice').textContent = `R$ ${parseFloat(item.price || 0).toFixed(2)}`;
  document.getElementById('modalCardLocation').textContent = `Folha ${item.location.sheet} (${item.location.side}) - Bolso ${item.location.pocket}`;

  // Configura o botão de remover de dentro do modal
  const btnRemoveModal = document.getElementById('modalBtnRemove');
  btnRemoveModal.onclick = () => {
    if (confirm(`Deseja remover ${item.name} do fichário?`)) {
      database.ref('pokedexCollection/' + key).remove();
      const modalEl = document.getElementById('cardModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();
    }
  };

  // Exibe o modal usando o Bootstrap nativo
  const modal = new bootstrap.Modal(document.getElementById('cardModal'));
  modal.show();
}
