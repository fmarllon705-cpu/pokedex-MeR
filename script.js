const TOTAL_SLOTS = 1800;
const USD_TO_BRL = 5.20; // Cotação média para conversão automática em R$

const SECTIONS = {
  main: { startSheet: 1 },
  fullart: { startSheet: 61 },
  valuable: { startSheet: 76 },
  cute: { startSheet: 89 }
};

// Elementos DOM
const sectionSelect = document.getElementById('section-select');
const pokemonInput = document.getElementById('pokemon-input');
const cardNumberInput = document.getElementById('card-number-input');
const btnSearch = document.getElementById('btn-search');
const btnSave = document.getElementById('btn-save');
const btnBackup = document.getElementById('btn-backup');
const btnTheme = document.getElementById('btn-theme');

const pokeImg = document.getElementById('poke-img');
const pokePlaceholderIcon = document.getElementById('poke-placeholder-icon');
const pokeName = document.getElementById('poke-name');
const pokeIdDisplay = document.getElementById('poke-id-display');

// Elementos de Seletor de Edição
const setSelectorContainer = document.getElementById('set-selector-container');
const cardSetSelect = document.getElementById('card-set-select');

// Elementos 3x3
const resSheetBadge = document.getElementById('res-sheet-badge');
const resSideBadge = document.getElementById('res-side-badge');
const resPocketBadge = document.getElementById('res-pocket-badge');
const pocketSlots = document.querySelectorAll('.pocket-slot');

const collectorDetails = document.getElementById('collector-details');
const cardLang = document.getElementById('card-lang');
const cardCondition = document.getElementById('card-condition');
const cardFinish = document.getElementById('card-finish');
const cardPrice = document.getElementById('card-price');
const cardShiny = document.getElementById('card-shiny');

const collectionGrid = document.getElementById('collection-grid');
const collectionCount = document.getElementById('collection-count');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const totalValueDisplay = document.getElementById('total-value-display');

const filterSection = document.getElementById('filter-section');
const filterSheet = document.getElementById('filter-sheet');
const searchSaved = document.getElementById('search-saved');
const sortOrder = document.getElementById('sort-order');

let currentPokemon = null;
let currentRawData = null;
let rawPokemonSprites = {};
let foundCardsList = []; 
let currentNationalId = 0;
let currentTypedNumber = '';

// 1. BUSCA INTELIGENTE NA POKÉMON TCG API (ATUALIZADA PARA PROMOS MEP)
async function searchPokemon() {
  const queryName = pokemonInput.value.trim().toLowerCase();
  let queryNumber = cardNumberInput.value.trim();

  if (!queryName) return alert("Digite o nome do Pokémon!");

  pokeName.textContent = "Buscando TCG...";
  pokeImg.style.display = "none";
  if (pokePlaceholderIcon) pokePlaceholderIcon.style.display = "block";
  collectorDetails.style.display = "none";
  setSelectorContainer.style.display = "none";
  cardSetSelect.innerHTML = "";

  const cleanNumber = queryNumber ? queryNumber.split('/')[0].replace(/^0+/, '') : '';
  currentTypedNumber = queryNumber;

  try {
    const pokeApiResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${queryName}`);
    currentNationalId = 0;
    if (pokeApiResponse.ok) {
      const pokeData = await pokeApiResponse.json();
      currentNationalId = pokeData.id;
      rawPokemonSprites = {
        default: pokeData.sprites.front_default || pokeData.sprites.other['official-artwork'].front_default,
        shiny: pokeData.sprites.front_shiny || pokeData.sprites.other['official-artwork'].front_shiny || pokeData.sprites.front_default
      };
    }

    // Estratégia de busca otimizada para abranger Promos (MEP / Black Star)
    let found = [];

    // 1. Tenta buscar pelo nome exato + número se informado
    let tcgQuery = `name:"${queryName}"`;
    if (cleanNumber) {
      tcgQuery += ` (number:"${cleanNumber}" OR number:"0${cleanNumber}" OR number:"00${cleanNumber}")`;
    }

    let tcgResponse = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(tcgQuery)}&orderBy=-set.releaseDate`);
    let tcgData = await tcgResponse.json();
    found = tcgData.data || [];

    // 2. Se não vier nada ou se for carta promo, busca por nome e filtra pelo número nas promos/conjuntos
    if (found.length === 0 && cleanNumber) {
      const promoQuery = `name:"${queryName}" number:"${cleanNumber}"`;
      const promoResp = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(promoQuery)}`);
      const promoData = await promoResp.json();
      found = promoData.data || [];
    }

    // 3. Fallback final: traz todas as versões do Pokémon para você escolher no menu dropdown
    if (found.length === 0) {
      const fallbackResponse = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${queryName}"&orderBy=-set.releaseDate&pageSize=50`);
      const fallbackData = await fallbackResponse.json();
      found = fallbackData.data || [];
    }

    foundCardsList = found;

    if (foundCardsList.length > 0) {
      cardSetSelect.innerHTML = "";
      foundCardsList.forEach((card, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        // Destaca se for carta de Promoção/Special Set
        const isPromo = card.set.id.toLowerCase().includes('mep') || card.set.series.toLowerCase().includes('promo');
        const promoTag = isPromo ? ' ⭐ [PROMO]' : '';
        option.textContent = `[${card.set.name}] Nº ${card.number}${promoTag}`;
        cardSetSelect.appendChild(option);
      });

      if (foundCardsList.length > 1) {
        setSelectorContainer.style.display = "block";
      }

      // Se houver uma correspondência exata com o número 005 / 5, seleciona ela automaticamente
      const matchIndex = foundCardsList.findIndex(c => c.number === cleanNumber || c.number === `0${cleanNumber}` || c.number === `00${cleanNumber}`);
      selectTcgCard(matchIndex !== -1 ? matchIndex : 0);

    } else {
      throw new Error("Nenhuma carta encontrada.");
    }

  } catch (error) {
    console.error(error);
    pokeName.textContent = "Não encontrado ❌";
    pokeIdDisplay.textContent = "#---";
    btnSave.style.display = "none";
    collectorDetails.style.display = "none";
    setSelectorContainer.style.display = "none";
    resetLocationInfo();
  }
}

// 2. APLICA A CARTA SELECIONADA À TELA
function selectTcgCard(index) {
  const card = foundCardsList[index];
  if (!card) return;

  let calculatedPrice = 0;
  if (card.tcgplayer && card.tcgplayer.prices) {
    const prices = card.tcgplayer.prices;
    const priceObj = prices.normal || prices.holofoil || prices.reverseHolofoil || prices.ungraded || prices.reverseHolo;
    if (priceObj) {
      const usdPrice = priceObj.market || priceObj.mid || priceObj.low || 0;
      calculatedPrice = (usdPrice * USD_TO_BRL).toFixed(2);
    }
  }

  const cardNumFormatted = `${card.number}/${card.set.printedTotal || '???'}`;

  currentPokemon = {
    id: currentNationalId || 0,
    name: card.name,
    cardNumber: cardNumFormatted,
    image: card.images.large || card.images.small,
    setName: card.set.name,
    section: sectionSelect.value,
    addedAt: new Date().toISOString()
  };

  pokeName.textContent = card.name;
  pokeIdDisplay.textContent = `#${String(currentPokemon.id).padStart(3, '0')} (${card.set.name} - Nº ${card.number})`;
  pokeImg.src = currentPokemon.image;
  pokeImg.style.display = "inline-block";
  if (pokePlaceholderIcon) pokePlaceholderIcon.style.display = "none";

  cardShiny.checked = false;
  cardPrice.value = calculatedPrice;
  cardFinish.value = "Normal";

  collectorDetails.style.display = "flex";
  btnSave.style.display = "block";

  calculatePhysicalPosition(currentPokemon.id || 1);
}

cardShiny.addEventListener('change', () => {
  if (!currentPokemon) return;
  if (rawPokemonSprites.shiny && cardShiny.checked) {
    pokeImg.src = rawPokemonSprites.shiny;
  } else {
    pokeImg.src = currentPokemon.image;
  }
});

// 3. CÁLCULO DA POSIÇÃO FÍSICA E HIGHLIGHT DO SLOT 3x3
function calculatePhysicalPosition(positionNumber) {
  const sectionKey = sectionSelect.value;
  const indexZeroBased = positionNumber - 1;

  const sheetOffset = Math.floor(indexZeroBased / 18);
  const actualSheet = SECTIONS[sectionKey].startSheet + sheetOffset;

  const positionInSheet = indexZeroBased % 18;
  const isFront = positionInSheet < 9;
  const sideText = isFront ? "Frente" : "Verso";

  const pocketNumber = (positionInSheet % 9) + 1;

  resSheetBadge.textContent = `Folha ${actualSheet}`;
  resSideBadge.textContent = sideText;
  resPocketBadge.textContent = `Bolso ${pocketNumber}`;

  pocketSlots.forEach(slot => {
    const slotNumber = parseInt(slot.getAttribute('data-pocket'), 10);
    if (slotNumber === pocketNumber) {
      slot.classList.add('active');
    } else {
      slot.classList.remove('active');
    }
  });

  currentPokemon.location = { sheet: actualSheet, side: sideText, pocket: pocketNumber };
}

function resetLocationInfo() {
  resSheetBadge.textContent = "Folha --";
  resSideBadge.textContent = "---";
  resPocketBadge.textContent = "Bolso -";
  pocketSlots.forEach(slot => slot.classList.remove('active'));
}

sectionSelect.addEventListener('change', () => {
  if (currentPokemon) {
    currentPokemon.section = sectionSelect.value;
    calculatePhysicalPosition(currentPokemon.id || 1);
  }
});

// 4. FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBxmA2lJlQHUKQrg-8_qyDmMvf7zXImhgc",
  authDomain: "pokedex-mer.firebaseapp.com",
  databaseURL: "https://pokedex-mer-default-rtdb.firebaseio.com/",
  projectId: "pokedex-mer",
  storageBucket: "pokedex-mer.firebasestorage.app",
  messagingSenderId: "450827685508",
  appId: "1:450827685508:web:0555d341ff9ccf857e7cd1",
  measurementId: "G-RYJXX19H5X"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const collectionRef = database.ref('pokedexCollection');

// 5. SALVAR CARTA
btnSave.addEventListener('click', () => {
  if (!currentPokemon) return;

  currentPokemon.lang = cardLang.value;
  currentPokemon.condition = cardCondition.value;
  currentPokemon.finish = cardFinish.value;
  currentPokemon.price = parseFloat(cardPrice.value) || 0;
  currentPokemon.isShiny = cardShiny.checked;

  const newCardRef = collectionRef.push();
  newCardRef.set(currentPokemon, (error) => {
    if (error) {
      alert("Erro ao salvar online: " + error.message);
    } else {
      alert(`${currentPokemon.name} (${currentPokemon.setName}) adicionado com sucesso! ❤️`);
    }
  });
});

// 6. ESCUTAR MUDANÇAS & RENDERIZAR
collectionRef.on('value', (snapshot) => {
  const data = snapshot.val();
  currentRawData = data;
  renderCollection();
});

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
      if (e.target.closest('button')) return; // Evita abrir se clicar direto no botão de excluir
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

// 7. FUNÇÃO PARA POPULAR E ABRIR O MODAL DA CARTA
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

  const btnRemoveModal = document.getElementById('modalBtnRemove');
  btnRemoveModal.onclick = () => {
    if (confirm(`Deseja remover ${item.name} do fichário?`)) {
      database.ref('pokedexCollection/' + key).remove();
      const modalEl = document.getElementById('cardModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();
    }
  };

  const modal = new bootstrap.Modal(document.getElementById('cardModal'));
  modal.show();
}

function updateProgressBar(count) {
  const percentage = ((count / TOTAL_SLOTS) * 100).toFixed(1);
  progressBar.style.width = `${percentage}%`;
  progressPercent.textContent = `${percentage}%`;
}

function removePokemon(firebaseKey) {
  if (confirm("Deseja remover esta carta da Pokédex compartilhada?")) {
    database.ref('pokedexCollection/' + firebaseKey).remove();
  }
}

// 8. MODO NOTURNO E EVENTOS GERAIS
btnTheme.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-bs-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', newTheme);
  btnTheme.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

btnBackup.addEventListener('click', () => {
  if (!currentRawData) return alert("Nenhum dado cadastrado para exportar!");
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentRawData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `pokedex-backup-${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

filterSection.addEventListener('change', renderCollection);
filterSheet.addEventListener('input', renderCollection);
searchSaved.addEventListener('input', renderCollection);
sortOrder.addEventListener('change', renderCollection);

btnSearch.addEventListener('click', searchPokemon);
pokemonInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchPokemon(); });
cardNumberInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchPokemon(); });
