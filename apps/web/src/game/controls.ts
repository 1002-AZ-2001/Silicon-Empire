import { FLOOR_TYPES, LOANS, MACHINE_TYPES, PURCHASE, isLineType } from '@silicon-empire/game-data';
import type {
  EraId, FloorType, HouseChip, LineType, RegionId, LoanId, MilestoneId, ResearchId, PcDesign, ProductModel, Specialty, SupplierId, TechId,
} from '@silicon-empire/game-data';
import {
  FixedStepClock, SITE_COMMAND_KINDS, cableChanges, cableCost, floorCost, lineCost, machineAt, regionalMaterialPercent, repairCost, ownsTile, parcelOf,
  parcelPrice, payoff, purchaseCost, siteOf, siteView, turnClockwise,
} from '@silicon-empire/simulation';
import { createStore } from 'zustand/vanilla';
import type { Messages, Translator } from '../i18n';
import type { ItemType, MachineType } from '@silicon-empire/game-data';
import type {
  Command, Company, LineTile, PurchaseLine, Rotation, RouterFilter, SiteCommand, Simulation, Speed, SubsidiarySettings, Tile, World,
} from '@silicon-empire/simulation';

/** Shop cart: lots per component, all from one supplier. Kept while the shop is closed. */
export interface Cart {
  readonly supplier: SupplierId;
  readonly lots: Readonly<Partial<Record<ItemType, number>>>;
}

export const EMPTY_CART: Cart = { supplier: 'express', lots: {} };

export function cartLines(cart: Cart): PurchaseLine[] {
  return (Object.entries(cart.lots) as [ItemType, number][])
    .filter(([, lots]) => lots > 0)
    .map(([item, lots]) => ({ item, supplier: cart.supplier, lots }));
}

/** Floor painting tools; concrete removes a covering. */
export type FloorTool = `floor:${FloorType}`;
export const FLOOR_TOOLS: readonly FloorTool[] = FLOOR_TYPES.map(floor => `floor:${floor}` as const);

/** Cables are drawn like floors: `cable` lays them, `uncable` removes them. */
export type CableTool = 'cable' | 'uncable';

export type Tool = 'inspect' | MachineType | 'demolish' | FloorTool | CableTool;

export function floorOf(tool: Tool): FloorType | null {
  return tool.startsWith('floor:') ? tool.slice('floor:'.length) as FloorType : null;
}

/** Tools drawn by dragging: conveyors, walls and floors. */
export function isCableTool(tool: Tool): tool is CableTool {
  return tool === 'cable' || tool === 'uncable';
}

export function isDrawTool(tool: Tool): boolean {
  return floorOf(tool) !== null || isCableTool(tool) || (isBuildTool(tool) && isLineType(tool));
}

interface Feedback {
  /** Built when displayed, so the message follows the current language. */
  message: (translator: Translator) => string;
  kind: 'success' | 'error';
}

interface WorkshopUi {
  tool: Tool;
  rotation: Rotation;
  hover: Tile | null;
  selectedId: number | null;
  /** Parcel not owned yet, picked on the map to see its price. */
  selectedParcel: number | null;
  demolitionId: number | null;
  feedback: Feedback | null;
  zoom: number;
  speed: Speed;
  /** Conveyor line being drawn, in drawing order. */
  line: LineTile[] | null;
  progressionOpen: boolean;
  researchOpen: boolean;
  salesOpen: boolean;
  shopOpen: boolean;
  staffOpen: boolean;
  companyOpen: boolean;
  bankOpen: boolean;
  techOpen: boolean;
  eraOpen: boolean;
  worldOpen: boolean;
  competitionOpen: boolean;
  /** Site abroad shown on the map; null for the home workshop. */
  site: RegionId | null;
  cart: Cart;
}


function errorMessage(reason: keyof Messages['errors']): Feedback['message'] {
  return ({ t }) => t.errors[reason];
}

/** Direction from one tile to a neighbouring tile. */
function directionTo(from: Tile, to: Tile): Rotation {
  if (to.x > from.x) return 1;
  if (to.x < from.x) return 3;
  return to.y > from.y ? 2 : 0;
}

/** Points the line along the drawn path; the last tile keeps the direction of the last step. */
function orient(path: readonly Tile[], fallback: Rotation): LineTile[] {
  return path.map((tile, index) => {
    const next = path[index + 1];
    const previous = path[index - 1];
    const rotation = next ? directionTo(tile, next) : previous ? directionTo(previous, tile) : fallback;
    return { x: tile.x, y: tile.y, rotation };
  });
}

export function isBuildTool(tool: Tool): tool is MachineType {
  return (MACHINE_TYPES as readonly string[]).includes(tool);
}

export function createWorkshopControls(simulation: Simulation, initialSpeed: Speed = 1) {
  const store = createStore<WorkshopUi>(() => ({
    tool: 'inspect',
    rotation: 0,
    hover: null,
    selectedId: null,
    selectedParcel: null,
    demolitionId: null,
    feedback: null,
    zoom: 1,
    speed: initialSpeed,
    line: null,
    progressionOpen: false,
    researchOpen: false,
    salesOpen: false,
    shopOpen: false,
    staffOpen: false,
    companyOpen: false,
    bankOpen: false,
    techOpen: false,
    eraOpen: false,
    worldOpen: false,
    competitionOpen: false,
    site: null,
    cart: EMPTY_CART,
  }));
  /** The world as the map shows it: the home workshop, or the view of the chosen site. */
  const view = (): World => {
    const world = simulation.getSnapshot();
    const region = store.getState().site;
    return region && siteOf(world, region) ? siteView(world, region) : world;
  };
  /** Layout commands go to the site shown on the map. */
  const dispatch = (command: Command) => {
    const region = store.getState().site;
    return simulation.dispatch(region && (SITE_COMMAND_KINDS as readonly string[]).includes(command.kind)
      ? { kind: 'at-site', region, command: command as SiteCommand } : command);
  };
  const clock = new FixedStepClock();
  clock.speed = initialSpeed;
  let resumeSpeed: Speed = initialSpeed === 0 ? 1 : initialSpeed;

  function setSpeed(speed: Speed) {
    if (speed !== 0) resumeSpeed = speed;
    clock.speed = speed;
    store.setState({ speed });
  }

  function togglePause() {
    setSpeed(clock.speed === 0 ? resumeSpeed : 0);
  }

  function startLine(tile: Tile) {
    store.setState({ line: orient([tile], store.getState().rotation) });
  }

  /** Extends the line to the pointed tile, through horizontal then vertical steps. Going back erases. */
  function extendLine(tile: Tile) {
    const { line, rotation } = store.getState();
    const last = line?.[line.length - 1];
    if (!line || !last || (last.x === tile.x && last.y === tile.y)) return;
    const path: Tile[] = line.map(({ x, y }) => ({ x, y }));
    let cursor: Tile = last;
    while (cursor.x !== tile.x || cursor.y !== tile.y) {
      cursor = cursor.x !== tile.x
        ? { x: cursor.x + Math.sign(tile.x - cursor.x), y: cursor.y }
        : { x: cursor.x, y: cursor.y + Math.sign(tile.y - cursor.y) };
      const visited = path.findIndex(step => step.x === cursor.x && step.y === cursor.y);
      if (visited >= 0) path.splice(visited + 1);
      else path.push(cursor);
    }
    store.setState({ line: orient(path, rotation) });
  }

  function cancelLine() {
    if (store.getState().line) store.setState({ line: null });
  }

  /** Builds the drawn line in one command. Returns false when the line has a single tile. */
  function finishLine(): boolean {
    const { line, tool } = store.getState();
    store.setState({ line: null });
    if (!line || line.length < 2) return false;
    const floor = floorOf(tool);
    if (floor) {
      paint(line, floor);
      return true;
    }
    if (isCableTool(tool)) {
      cable(line, tool === 'cable');
      return true;
    }
    const type: LineType = isBuildTool(tool) && isLineType(tool) ? tool : 'conveyor';
    const result = dispatch({ kind: 'build-line', tiles: line, type });
    store.setState({
      feedback: result.ok
        ? {
          kind: 'success',
          message: ({ t, money }) => (type === 'wall' ? t.feedback.wallsBuilt : t.feedback.lineBuilt)(line.length, money(lineCost(line.length, type))),
        }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
    return true;
  }

  function cable(tiles: readonly Tile[], laying: boolean) {
    const world = view();
    const count = cableChanges(world, tiles, laying).length;
    const cost = laying ? cableCost(world, tiles) : 0;
    const result = dispatch(laying ? { kind: 'lay-cable', tiles } : { kind: 'remove-cable', tiles });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t, money }) => laying ? t.feedback.cablesLaid(count, money(cost)) : t.feedback.cablesRemoved(count) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function repair(id: number) {
    const machine = view().machines.find(candidate => candidate.id === id);
    const cost = machine ? repairCost(machine) : 0;
    const result = dispatch({ kind: 'repair', id });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t, money }) => t.feedback.repaired(money(cost)) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function paint(tiles: readonly Tile[], floor: FloorType) {
    const world = view();
    const cost = floorCost(world, tiles, floor);
    const result = dispatch({ kind: 'paint-floor', tiles, floor });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t, money }) => t.feedback.floorPainted(t.floors[floor], money(cost)) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function selectResearch(research: ResearchId | null) {
    const result = dispatch({ kind: 'select-research', research });
    if (!result.ok) store.setState({ feedback: { kind: 'error', message: errorMessage(result.reason) } });
  }

  function upgrade(id: number) {
    const result = dispatch({ kind: 'upgrade', id });
    const level = result.ok ? result.machine?.level ?? 2 : 2;
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.upgradedTo(level) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function selectMilestone(milestone: MilestoneId | null) {
    const result = dispatch({ kind: 'select-milestone', milestone });
    if (!result.ok) store.setState({ feedback: { kind: 'error', message: errorMessage(result.reason) } });
  }

  function setProductModel(id: number, model: ProductModel) {
    const result = dispatch({ kind: 'set-product-model', id, model });
    store.setState({ feedback: result.ok ? null : { kind: 'error', message: errorMessage(result.reason) } });
  }

  function changeSale(model?: ProductModel) {
    const result = dispatch(model ? { kind: 'start-sale', model } : { kind: 'cancel-sale' });
    if (!result.ok) store.setState({ feedback: { kind: 'error', message: errorMessage(result.reason) } });
  }

  function configure(id: number, filter: RouterFilter | null) {
    const result = dispatch({ kind: 'configure', id, filter });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => filter ? t.feedback.filterSet(t.items[filter.item]) : t.feedback.filterCleared }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function order(id: number, item: ItemType, supplier: SupplierId = 'express') {
    const result = dispatch({ kind: 'order', id, item, supplier });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => supplier === 'express' ? t.feedback.delivered(PURCHASE.lotSize, t.items[item]) : t.supply.reserved }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  /** Buys the whole cart for one dock; the cart is emptied only when the order goes through. */
  function checkout(dock: number) {
    const lines = cartLines(store.getState().cart);
    const lots = lines.reduce((total, line) => total + line.lots, 0);
    const cost = purchaseCost(lines, regionalMaterialPercent(view()));
    const result = dispatch({ kind: 'purchase', id: dock, lines });
    store.setState(state => ({
      cart: result.ok ? { ...state.cart, lots: {} } : state.cart,
      feedback: result.ok
        ? { kind: 'success', message: ({ t, money }) => t.feedback.purchased(lots, money(cost)) }
        : { kind: 'error', message: errorMessage(result.reason) },
    }));
    return result.ok;
  }

  /** Runs a career command and reports its result with the given message. */
  function career(command: Command, message: Feedback['message']) {
    const result = dispatch(command);
    store.setState({ feedback: result.ok ? { kind: 'success', message } : { kind: 'error', message: errorMessage(result.reason) } });
    return result.ok;
  }

  const chooseSpecialty = (specialty: Specialty) =>
    career({ kind: 'choose-specialty', specialty }, ({ t }) => t.feedback.specialtyChosen(t.career.tech.names[specialty]));
  const takeLoan = (offer: LoanId) =>
    career({ kind: 'take-loan', offer }, ({ t, money }) => t.feedback.loanTaken(money(LOANS[offer].principalCents)));
  const buyTech = (tech: TechId) =>
    career({ kind: 'buy-tech', tech }, ({ t }) => t.feedback.techBought(t.career.tech.names[tech]));
  const buyFactory = (region: RegionId) =>
    career({ kind: 'buy-factory', region }, ({ t }) => t.feedback.factoryBought(t.world.regions[region]));
  const setSubsidiary = (region: RegionId, settings: SubsidiarySettings) =>
    career({ kind: 'set-subsidiary', region, ...settings }, ({ t }) => t.feedback.subsidiarySet(t.world.regions[region]));
  const setHouseChips = (chips: readonly HouseChip[]) =>
    career({ kind: 'set-house-chips', chips }, ({ t }) => t.feedback.houseChipsSet);
  /** Shows a site abroad on the map, or the home workshop. */
  function selectSite(site: RegionId | null) {
    store.setState({ site, selectedId: null, selectedParcel: null, demolitionId: null, line: null, tool: 'inspect' });
  }
  const adoptEra = (era: EraId) =>
    career({ kind: 'adopt-era', era }, ({ t }) => t.feedback.eraAdopted(t.eras.names[era]));
  function repayLoan(offer: LoanId) {
    const loan = view().progress.career?.loans.find(candidate => candidate.offer === offer);
    const cost = loan ? payoff(loan) : 0;
    return career({ kind: 'repay-loan', offer }, ({ t, money }) => t.feedback.loanRepaid(money(cost)));
  }

  function setRestock(id: number, items: readonly ItemType[]) {
    const result = dispatch({ kind: 'set-restock', id, items });
    store.setState({
      feedback: result.ok ? { kind: 'success', message: ({ t }) => t.feedback.restockSet } : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function brand(company: Company) {
    const result = dispatch({ kind: 'brand', company });
    store.setState({
      feedback: result.ok ? { kind: 'success', message: ({ t }) => t.feedback.brandSaved } : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function buyParcel(parcel: number) {
    const cost = parcelPrice(view());
    const result = dispatch({ kind: 'buy-parcel', parcel });
    store.setState({
      selectedParcel: result.ok ? null : parcel,
      feedback: result.ok
        ? { kind: 'success', message: ({ t, money }) => t.feedback.parcelBought(money(cost)) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function hire(candidate: number) {
    const name = view().staff.candidates.find(person => person.id === candidate)?.name ?? '';
    const result = dispatch({ kind: 'hire', candidate });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.hired(name) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function fire(employee: number) {
    const name = view().staff.employees.find(person => person.id === employee)?.name ?? '';
    const result = dispatch({ kind: 'fire', employee });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.fired(name) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function assign(employee: number, machine: number | null) {
    const result = dispatch({ kind: 'assign', employee, machine });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.assigned }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function setCartLots(item: ItemType, lots: number) {
    store.setState(({ cart }) => {
      const next = { ...cart.lots };
      if (lots > 0) next[item] = Math.min(lots, PURCHASE.maxLots);
      else delete next[item];
      return { cart: { ...cart, lots: next } };
    });
  }

  function publishDesign(spec: PcDesign) {
    const result = dispatch({ kind: 'publish-design', spec });
    return result.ok ? null : result.reason;
  }

  function selectTool(tool: Tool) {
    const current = store.getState();
    store.setState({
      tool,
      rotation: tool === current.tool ? current.rotation : 0,
      selectedId: null,
      feedback: null,
      line: null,
    });
  }

  function aimAt(hover: Tile | null) {
    const current = store.getState().hover;
    if (current?.x === hover?.x && current?.y === hover?.y) return;
    store.setState({ hover });
  }

  function activateTile(tile: Tile) {
    const { tool, rotation } = store.getState();
    const floor = floorOf(tool);
    if (floor) {
      paint([tile], floor);
      return;
    }
    if (isCableTool(tool)) {
      cable([tile], tool === 'cable');
      return;
    }
    if (isBuildTool(tool)) {
      const result = dispatch({ kind: 'build', type: tool, ...tile, rotation });
      store.setState({
        feedback: result.ok
          ? { kind: 'success', message: ({ t }) => t.feedback.built(t.machines[tool].name) }
          : { kind: 'error', message: errorMessage(result.reason) },
      });
      // The headquarters is unique: once placed, show it in the inspector.
      if (result.ok && tool === 'headquarters' && result.machine) {
        store.setState({ tool: 'inspect', selectedId: result.machine.id, rotation: 0 });
      }
      return;
    }

    const world = view();
    const id = machineAt(world, tile)?.id ?? null;
    const outside = tile.x >= 0 && tile.y >= 0 && tile.x < world.columns && tile.y < world.rows && !ownsTile(world, tile);
    store.setState(tool === 'demolish'
      ? { demolitionId: id, feedback: null }
      : { selectedId: id, selectedParcel: outside ? parcelOf(tile) : null, feedback: null });
  }

  function rotate() {
    const { tool, selectedId, rotation } = store.getState();
    if (isBuildTool(tool)) {
      store.setState({ rotation: turnClockwise(rotation), feedback: null });
    } else if (tool === 'inspect' && selectedId !== null) {
      const result = dispatch({ kind: 'rotate', id: selectedId });
      store.setState({
        feedback: result.ok
          ? { kind: 'success', message: ({ t }) => t.feedback.rotated }
          : { kind: 'error', message: errorMessage(result.reason) },
      });
    }
  }

  function confirmDemolition() {
    const { demolitionId } = store.getState();
    if (demolitionId === null) return;

    const result = dispatch({ kind: 'demolish', id: demolitionId });
    store.setState({
      demolitionId: null,
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.demolished }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  return {
    store, clock, setSpeed, togglePause, order, checkout, setCartLots, buyParcel, hire, fire, assign, chooseSpecialty, takeLoan, repayLoan, buyTech, adoptEra, selectSite, setHouseChips, buyFactory, setSubsidiary, repair, setRestock, brand, configure, selectMilestone, selectResearch, upgrade, setProductModel,
    startSale: (model: ProductModel) => changeSale(model), cancelSale: () => changeSale(),
    publishDesign,
    startLine, extendLine, cancelLine, finishLine,
    selectTool, aimAt, activateTile, rotate, confirmDemolition,
  };
}

export type WorkshopControls = ReturnType<typeof createWorkshopControls>;
