// Configuração do Fichário de 100 Folhas
const SECTIONS = {
  main: { startSheet: 1 },
  fullart: { startSheet: 61 },
  valuable: { startSheet: 76 },
  cute: { startSheet: 89 }
};

// Elementos DOM
const sectionSelect = document.getElementById('section-select');
const pokemonInput = document.getElementById('pokemon-input');
const btnSearch = document.getElementById('btn-search');
const btnSave = document.getElementById('btn-save');

const pokeImg = document.getElementById('poke-img');
const pokePlaceholderIcon = document.getElementById('poke-placeholder-icon');
const pokeName = document.getElementById('poke-name');
const pokeIdDisplay = document.getElementById('poke-id-display');

const resSheet = document.getElementById('res-sheet');
const resSide = document.getElementById('res-side');
const resPocket = document.getElementById('res-pocket');
const pockets = document.querySelectorAll('.pocket');

const collectionGrid = document.getElementById('collection-grid');
const collectionCount = document.getElementById('collection-count');

let currentPokemon = null;
let myCollection = JSON.parse(localStorage.getItem('myPokedexCollection')) || [];

// 1. BUSCAR POKÉMON NA POKÉAPI
async function searchPokemon() {
  const query = pokemonInput.value.trim().toLowerCase();
  if (!query) return alert("Digite o nome ou número do Pokémon!");

  pokeName.textContent = "Buscando...";
  pokeImg.style.display = "none";
  if (pokePlaceholderIcon) pokePlaceholderIcon.style.display = "block";

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`);
    if (!response.ok) throw new Error("Pokémon não encontrado");

    const data = await response.json();

    currentPokemon = {
      id: data.id,
      name: data.name,
      image: data.sprites.front_default || data.sprites.other['official-artwork'].front_default,
      section: sectionSelect.value
    };

    // Atualiza Visual
    pokeName.textContent = currentPokemon.name;
    pokeIdDisplay.textContent = `#${String(currentPokemon.id).padStart(3, '0')}`;
    pokeImg.src = currentPokemon.image;
    pokeImg.style.display = "inline-block";
    if (pokePlaceholderIcon) pokePlaceholderIcon.style.display = "none";
    
    btnSave.style.display = "block";

    calculatePhysicalPosition(currentPokemon.id);

  } catch (error) {
    pokeName.textContent = "Não encontrado ❌";
    pokeIdDisplay.textContent = "#---";
    btnSave.style.display = "none";
    resetLocationInfo();
  }
}

// 2. CÁLCULO DA POSIÇÃO FÍSICA
function calculatePhysicalPosition(positionNumber) {
  const sectionKey = sectionSelect.value;
  const indexZeroBased = positionNumber - 1;

  const sheetOffset = Math.floor(indexZeroBased / 18);
  const actualSheet = SECTIONS[sectionKey].startSheet + sheetOffset;

  const positionInSheet = indexZeroBased % 18;
  const isFront = positionInSheet < 9;
  const sideText = isFront ? "Frente" : "Verso";

  const pocketNumber = (positionInSheet % 9) + 1;

  resSheet.textContent = actualSheet;
  resSide.textContent = sideText;
  resPocket.textContent = pocketNumber;

  currentPokemon.location = { sheet: actualSheet, side: sideText, pocket: pocketNumber };

  highlightPocket(pocketNumber);
}

function highlightPocket(targetPocket) {
  pockets.forEach(pocket => {
    const pocketId = parseInt(pocket.getAttribute('data-pocket'), 10);
    pocket.classList.toggle('active', pocketId === targetPocket);
  });
}

function resetLocationInfo() {
  resSheet.textContent = "-";
  resSide.textContent = "-";
  resPocket.textContent = "-";
  highlightPocket(0);
}

// 1. CONFIGURAÇÃO DO FIREBASE (Cole as credenciais do seu console aqui)
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

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const collectionRef = database.ref('pokedexCollection');

// 2. SALVAR NO FIREBASE (Substitui o localStorage)
btnSave.addEventListener('click', () => {
  if (!currentPokemon) return;

  // Envia diretamente para o banco em nuvem
  const newCardRef = collectionRef.push();
  newCardRef.set(currentPokemon, (error) => {
    if (error) {
      alert("Erro ao salvar online: " + error.message);
    } else {
      alert(`${currentPokemon.name} adicionado à Pokédex do casal! ❤️`);
    }
  });
});

// 3. ESCUTAR MUDANÇAS EM TEMPO REAL (Atualiza no celular das duas instantaneamente)
collectionRef.on('value', (snapshot) => {
  collectionGrid.innerHTML = "";
  const data = snapshot.val();
  
  if (!data) {
    collectionCount.textContent = "0";
    return;
  }

  const items = Object.entries(data); // Transforma o objeto do Firebase em lista
  collectionCount.textContent = items.length;

  items.forEach(([key, item]) => {
    const card = document.createElement('div');
    card.classList.add('virtual-card');
    card.innerHTML = `
      <button class="btn-remove" onclick="removePokemon('${key}')"><i class="bi bi-x"></i></button>
      <img src="${item.image}" alt="${item.name}">
      <span class="card-title text-capitalize">${item.name}</span>
      <span class="badge bg-warning text-dark fs-8 w-100 mt-1">F:${item.location.sheet} | ${item.location.side[0]} | B:${item.location.pocket}</span>
    `;
    collectionGrid.appendChild(card);
  });
});

// 4. REMOVER CARD EM NUVEM
function removePokemon(firebaseKey) {
  if (confirm("Deseja remover esta carta da Pokédex compartilhada?")) {
    database.ref('pokedexCollection/' + firebaseKey).remove();
  }
}

// OUVINTES DE EVENTOS DA BUSCA
btnSearch.addEventListener('click', searchPokemon);
pokemonInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchPokemon();
});