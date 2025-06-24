import { MerkleTree, MerkleWitness, CircuitString, Field, Poseidon, Struct } from 'o1js';
import { fetchGLEIFCompanyData } from './GLEIFUtils.js';

// Merkle witness for tree height 9 (supports 512 fields)
class MerkleWitness9 extends MerkleWitness(9) {}

// Enhanced GLEIF data structure using Merkle Tree
export class GLEIFMerkleTree {
  values: {key: number, value: Field[], fieldName: string}[];
  tree: MerkleTree;

  constructor(parsedData: any) {
    this.values = this.parseGLEIFToTreeData(parsedData);
    this.tree = new MerkleTree(9); // Support 512 fields
    
    // Populate tree with hashed field values
    for(const {key, value} of this.values) {
      this.tree.setLeaf(BigInt(key), Poseidon.hash(value));
    }
  }

  private parseGLEIFToTreeData(parsedData: any): {key: number, value: Field[], fieldName: string}[] {
    const record = parsedData.data[0];
    const attributes = record.attributes;
    const entity = attributes.entity;
    const legalAddress = entity.legalAddress || {};
    const headquartersAddress = entity.headquartersAddress || {};
    const registration = attributes.registration || {};

    // Helper function to safely set field in tree
    const createFieldEntry = (key: number, value: string | undefined, fieldName: string) => {
      const safeValue = value || '';
      return {
        key,
        value: CircuitString.fromString(safeValue).values.map(c => c.toField()),
        fieldName
      };
    };

    // Helper function to safely join arrays
    const joinArray = (arr: any[] | undefined): string => {
      if (!Array.isArray(arr)) return '';
      return arr.map(item => typeof item === 'string' ? item : item?.name || '').join(', ');
    };

    return [
      // Core identifiers (0-9)
      createFieldEntry(0, record.type, 'type'),
      createFieldEntry(1, record.id, 'id'),
      createFieldEntry(2, attributes.lei, 'lei'),
      createFieldEntry(3, entity.legalName?.name, 'name'),
      createFieldEntry(4, entity.status, 'entity_status'),
      createFieldEntry(5, registration.status, 'registration_status'),
      createFieldEntry(6, attributes.conformityFlag || (registration as any).conformityFlag, 'conformity_flag'),

      // Temporal fields (10-19)
      createFieldEntry(10, registration.initialRegistrationDate, 'initialRegistrationDate'),
      createFieldEntry(11, registration.lastUpdateDate, 'lastUpdateDate'),
      createFieldEntry(12, registration.nextRenewalDate, 'nextRenewalDate'),
      createFieldEntry(13, entity.expiration?.date, 'expiration_date'),
      createFieldEntry(14, entity.creationDate, 'creationDate'),

      // Legal name and other names (20-29)
      createFieldEntry(20, entity.legalName?.language, 'legalName_language'),
      createFieldEntry(21, entity.otherNames?.[0]?.name, 'otherNames_first'),
      createFieldEntry(22, entity.otherNames?.[1]?.name, 'otherNames_second'),
      createFieldEntry(23, joinArray(entity.transliteratedOtherNames), 'transliteratedOtherNames'),

      // Legal address (30-39)
      createFieldEntry(30, legalAddress.language, 'legalAddress_language'),
      createFieldEntry(31, joinArray(legalAddress.addressLines), 'legalAddress_addressLines'),
      createFieldEntry(32, legalAddress.city, 'legalAddress_city'),
      createFieldEntry(33, legalAddress.region, 'legalAddress_region'),
      createFieldEntry(34, legalAddress.country, 'legalAddress_country'),
      createFieldEntry(35, legalAddress.postalCode, 'legalAddress_postalCode'),
      createFieldEntry(36, legalAddress.mailRouting, 'legalAddress_mailRouting'),

      // Headquarters address (40-49)
      createFieldEntry(40, headquartersAddress.language, 'headquartersAddress_language'),
      createFieldEntry(41, joinArray(headquartersAddress.addressLines), 'headquartersAddress_addressLines'),
      createFieldEntry(42, headquartersAddress.city, 'headquartersAddress_city'),
      createFieldEntry(43, headquartersAddress.region, 'headquartersAddress_region'),
      createFieldEntry(44, headquartersAddress.country, 'headquartersAddress_country'),
      createFieldEntry(45, headquartersAddress.postalCode, 'headquartersAddress_postalCode'),

      // Registration info (50-59)
      createFieldEntry(50, entity.registeredAt?.id, 'registeredAt_id'),
      createFieldEntry(51, entity.registeredAt?.other, 'registeredAt_other'),
      createFieldEntry(52, entity.registeredAs, 'registeredAs'),
      createFieldEntry(53, entity.jurisdiction, 'jurisdiction'),
      createFieldEntry(54, entity.legalForm?.id, 'legalForm_id'),
      createFieldEntry(55, entity.legalForm?.other, 'legalForm_other'),
      createFieldEntry(56, entity.category, 'category'),
      createFieldEntry(57, entity.subCategory, 'subCategory'),

      // Managing and validation (60-69)
      createFieldEntry(60, registration.managingLou, 'managingLou'),
      createFieldEntry(61, registration.corroborationLevel, 'corroborationLevel'),
      createFieldEntry(62, registration.validatedAt?.id, 'validatedAt_id'),
      createFieldEntry(63, registration.validatedAt?.other, 'validatedAt_other'),
      createFieldEntry(64, registration.validatedAs, 'validatedAs'),

      // Financial codes (70-79)
      createFieldEntry(70, joinArray(record.attributes.bic), 'bic_codes'),
      createFieldEntry(71, joinArray(record.attributes.mic), 'mic_codes'),
      createFieldEntry(72, joinArray(record.attributes.ocid), 'ocid_codes'),
      createFieldEntry(73, joinArray(record.attributes.spglobal), 'spglobal_codes'),
      createFieldEntry(74, joinArray(record.attributes.isin), 'isin_codes'),

      // Relationships (80-89)
      createFieldEntry(80, entity.directParent?.lei, 'directParent_lei'),
      createFieldEntry(81, entity.ultimateParent?.lei, 'ultimateParent_lei'),
      createFieldEntry(82, entity.directChildren?.length?.toString(), 'directChildren_count'),
      createFieldEntry(83, entity.managingLou, 'managingLou_related'),
      createFieldEntry(84, entity.leiIssuer, 'leiIssuer_related'),

      // Additional fields (90-99)
      createFieldEntry(90, entity.associatedEntity?.lei, 'associatedEntity_lei'),
      createFieldEntry(91, entity.successorEntity?.lei, 'successorEntity_lei'),
      createFieldEntry(92, entity.predecessorEntity?.lei, 'predecessorEntity_lei'),

      // Extended address info (100-109)
      createFieldEntry(100, entity.otherAddresses?.[0]?.type, 'otherAddresses_first'),
      createFieldEntry(101, entity.otherAddresses?.[1]?.type, 'otherAddresses_second'),

      // Business metadata (110-119)
      createFieldEntry(110, joinArray(entity.eventGroups), 'eventGroups'),
      createFieldEntry(111, entity.fund?.info, 'fund_info'),
      createFieldEntry(112, entity.branch?.info, 'branch_info'),

      // Compliance and status (120-129)
      createFieldEntry(120, registration.validatedStatus, 'registration_validatedStatus'),
      createFieldEntry(121, entity.expiration?.reason, 'entity_expiration_reason'),
      createFieldEntry(122, registration.conformityFlag, 'registration_conformityFlag'),

      // Reserve for future expansion (130-255)
      createFieldEntry(130, '', 'reserved_130'),
      createFieldEntry(140, '', 'reserved_140'),
      createFieldEntry(150, '', 'reserved_150'),
    ];
  }

  get root(): Field {
    return this.tree.getRoot();
  }

  public witness(index: number): MerkleWitness9 {
    return new MerkleWitness9(this.tree.getWitness(BigInt(index)));
  }

  // Get field value by index
  public getFieldValue(index: number): CircuitString {
    const field = this.values.find(v => v.key === index);
    if (!field) {
      throw new Error(`Field with index ${index} not found`);
    }
    // Convert Field array back to CircuitString
    const characters = field.value.map(f => {
      const charValue = Number(f.toBigInt()) % 256; // Convert Field to character code
      return String.fromCharCode(charValue);
    }).join('');
    return CircuitString.fromString(characters);
  }

  // Get field name by index
  public getFieldName(index: number): string {
    const field = this.values.find(v => v.key === index);
    if (!field) {
      throw new Error(`Field with index ${index} not found`);
    }
    return field.fieldName;
  }

  // List all available fields
  public listFields(): {index: number, name: string, value: string}[] {
    return this.values.map(field => ({
      index: field.key,
      name: field.fieldName,
      value: CircuitString.fromFields(field.value).toString()
    }));
  }
}

// Batch Merkle Tree for multiple companies
class MerkleWitness10 extends MerkleWitness(10) {}

export class GLEIFBatchMerkleTree {
  companyTrees: GLEIFMerkleTree[];
  batchTree: MerkleTree;

  constructor(companiesData: any[]) {
    this.companyTrees = companiesData.map(data => new GLEIFMerkleTree(data));
    this.batchTree = new MerkleTree(10); // Support up to 1024 companies
    
    // Populate batch tree with company roots
    this.companyTrees.forEach((companyTree, index) => {
      this.batchTree.setLeaf(BigInt(index), companyTree.root);
    });
  }

  get root(): Field {
    return this.batchTree.getRoot();
  }

  public companyWitness(companyIndex: number): MerkleWitness10 {
    return new MerkleWitness10(this.batchTree.getWitness(BigInt(companyIndex)));
  }

  public getCompanyTree(index: number): GLEIFMerkleTree {
    return this.companyTrees[index];
  }
}

// Utility class for GLEIF Merkle operations
export class GLEIFMerkleUtils {
  
  // Complete field index mappings matching GLEIFOptimVerificationTestWithSign (130+ fields)
  static readonly FIELD_INDICES: Record<string, number> = {
    // Core identifiers (0-9)
    'type': 0,
    'id': 1,
    'lei': 2,
    'name': 3,
    'entity_status': 4,
    'registration_status': 5,
    'conformity_flag': 6,
    
    // Temporal fields (10-19)
    'initialRegistrationDate': 10,
    'lastUpdateDate': 11,
    'nextRenewalDate': 12,
    'expiration_date': 13,
    'creationDate': 14,
    
    // Legal name and other names (20-29)
    'legalName_language': 20,
    'otherNames_first': 21,
    'otherNames_second': 22,
    'transliteratedOtherNames': 23,
    
    // Legal address (30-39)
    'legalAddress_language': 30,
    'legalAddress_addressLines': 31,
    'legalAddress_city': 32,
    'legalAddress_region': 33,
    'legalAddress_country': 34,
    'legalAddress_postalCode': 35,
    'legalAddress_mailRouting': 36,
    
    // Headquarters address (40-49)
    'headquartersAddress_language': 40,
    'headquartersAddress_addressLines': 41,
    'headquartersAddress_city': 42,
    'headquartersAddress_region': 43,
    'headquartersAddress_country': 44,
    'headquartersAddress_postalCode': 45,
    
    // Registration info (50-59)
    'registeredAt_id': 50,
    'registeredAt_other': 51,
    'registeredAs': 52,
    'jurisdiction': 53,
    'legalForm_id': 54,
    'legalForm_other': 55,
    'category': 56,
    'subCategory': 57,
    
    // Managing and validation (60-69)
    'managingLou': 60,
    'corroborationLevel': 61,
    'validatedAt_id': 62,
    'validatedAt_other': 63,
    'validatedAs': 64,
    
    // Financial codes (70-79)
    'bic_codes': 70,
    'mic_codes': 71,
    'ocid_codes': 72,
    'spglobal_codes': 73,
    'isin_codes': 74,
    
    // Relationships (80-89)
    'directParent_lei': 80,
    'ultimateParent_lei': 81,
    'directChildren_count': 82,
    'managingLou_related': 83,
    'leiIssuer_related': 84,
    
    // Additional fields (90-99)
    'associatedEntity_lei': 90,
    'successorEntity_lei': 91,
    'predecessorEntity_lei': 92,
    
    // Extended address info (100-109)
    'otherAddresses_first': 100,
    'otherAddresses_second': 101,
    
    // Business metadata (110-119)
    'eventGroups': 110,
    'fund_info': 111,
    'branch_info': 112,
    
    // Compliance and status (120-129)
    'registration_validatedStatus': 120,
    'entity_expiration_reason': 121,
    'registration_conformityFlag': 122,
    
    // Reserve for future expansion (130-255)
    'reserved_130': 130,
    'reserved_140': 140,
    'reserved_150': 150,
  };

  // Create Merkle tree from GLEIF API data
  static async createGLEIFMerkleTree(companyName: string): Promise<GLEIFMerkleTree> {
    console.log(`🌳 Creating Merkle tree for company: ${companyName}`);
    const parsedData = await fetchGLEIFCompanyData(companyName);
    const tree = new GLEIFMerkleTree(parsedData);
    
    console.log(`✅ Merkle tree created with ${tree.values.length} fields`);
    console.log(`🔗 Root hash: ${tree.root.toString()}`);
    
    return tree;
  }

  // Create batch tree for multiple companies
  static async createBatchMerkleTree(companyNames: string[]): Promise<GLEIFBatchMerkleTree> {
    console.log(`🏢 Creating batch tree for ${companyNames.length} companies`);
    
    const companiesData = await Promise.all(
      companyNames.map(async (name, index) => {
        console.log(`  📡 Fetching data for company ${index + 1}/${companyNames.length}: ${name}`);
        return await fetchGLEIFCompanyData(name);
      })
    );
    
    const batchTree = new GLEIFBatchMerkleTree(companiesData);
    console.log(`✅ Batch tree created with root: ${batchTree.root.toString()}`);
    
    return batchTree;
  }

  // Get witnesses for specific fields
  static getFieldWitnesses(tree: GLEIFMerkleTree, fieldNames: string[]): MerkleWitness9[] {
    return fieldNames.map(fieldName => {
      const index = this.FIELD_INDICES[fieldName as keyof typeof this.FIELD_INDICES];
      if (index === undefined) {
        throw new Error(`Unknown field name: ${fieldName}. Available fields: ${Object.keys(this.FIELD_INDICES).join(', ')}`);
      }
      return tree.witness(index);
    });
  }

  // Get field values for specific fields
  static getFieldValues(tree: GLEIFMerkleTree, fieldNames: string[]): CircuitString[] {
    return fieldNames.map(fieldName => {
      const index = this.FIELD_INDICES[fieldName as keyof typeof this.FIELD_INDICES];
      if (index === undefined) {
        throw new Error(`Unknown field name: ${fieldName}. Available fields: ${Object.keys(this.FIELD_INDICES).join(', ')}`);
      }
      return tree.getFieldValue(index);
    });
  }

  // Verify a field exists in the tree (useful for testing)
  static verifyFieldInTree(tree: GLEIFMerkleTree, fieldName: string, expectedValue?: string): boolean {
    try {
      const index = this.FIELD_INDICES[fieldName as keyof typeof this.FIELD_INDICES];
      if (index === undefined) return false;

      const witness = tree.witness(index);
      const fieldValue = tree.getFieldValue(index);
      const fieldHash = Poseidon.hash(fieldValue.values.map(c => c.toField()));
      const calculatedRoot = witness.calculateRoot(fieldHash);
      
      const rootMatches = calculatedRoot.equals(tree.root).toBoolean();
      
      if (expectedValue) {
        const valueMatches = fieldValue.toString() === expectedValue;
        console.log(`🔍 Field '${fieldName}': Root match=${rootMatches}, Value match=${valueMatches}`);
        return rootMatches && valueMatches;
      }
      
      console.log(`🔍 Field '${fieldName}': Root match=${rootMatches}`);
      return rootMatches;
    } catch (error) {
      console.error(`❌ Error verifying field '${fieldName}':`, error);
      return false;
    }
  }

  // Print tree summary
  static printTreeSummary(tree: GLEIFMerkleTree): void {
    console.log('\n📊 GLEIF Merkle Tree Summary:');
    console.log(`🔗 Root: ${tree.root.toString()}`);
    console.log(`📁 Total fields: ${tree.values.length}`);
    console.log('\n📋 Available fields:');
    
    const fields = tree.listFields();
    fields.forEach((field, index) => {
      const truncatedValue = field.value.length > 50 ? 
        field.value.substring(0, 47) + '...' : field.value;
      console.log(`  ${index.toString().padStart(2)}: ${field.name.padEnd(25)} = "${truncatedValue}"`);
    });
    console.log('');
  }

  // Get core compliance fields (matching original implementation)
  static getCoreComplianceFields(tree: GLEIFMerkleTree): {
    witnesses: MerkleWitness9[],
    values: CircuitString[]
  } {
    const coreFields = ['name', 'entity_status', 'registration_status', 'lei'];
    return {
      witnesses: this.getFieldWitnesses(tree, coreFields),
      values: this.getFieldValues(tree, coreFields)
    };
  }

  // Get extended fields for comprehensive verification
  static getExtendedComplianceFields(tree: GLEIFMerkleTree): {
    witnesses: MerkleWitness9[],
    values: CircuitString[],
    fieldNames: string[]
  } {
    const extendedFields = [
      'name', 'entity_status', 'registration_status', 'lei', 
      'legalAddress_country', 'legalAddress_city', 
      'jurisdiction'
    ];
    return {
      witnesses: this.getFieldWitnesses(tree, extendedFields),
      values: this.getFieldValues(tree, extendedFields),
      fieldNames: extendedFields
    };
  }

  // Get comprehensive business logic fields (matching GLEIFOptimVerificationTestWithSign)
  static getComprehensiveComplianceFields(tree: GLEIFMerkleTree): {
    witnesses: MerkleWitness9[],
    values: CircuitString[],
    fieldNames: string[]
  } {
    const comprehensiveFields = [
      'lei', 'name', 'entity_status', 'registration_status', 'conformity_flag',
      'initialRegistrationDate', 'lastUpdateDate', 'nextRenewalDate',
      'bic_codes', 'mic_codes', 'managingLou'
    ];
    return {
      witnesses: this.getFieldWitnesses(tree, comprehensiveFields),
      values: this.getFieldValues(tree, comprehensiveFields),
      fieldNames: comprehensiveFields
    };
  }
}

export { MerkleWitness9 };

// Additional utilities for business logic validation
export class GLEIFBusinessLogicUtils {
  
  // Entity status validation (matching GLEIFOptimVerificationTestWithSign)
  static isEntityStatusActive(status: CircuitString): boolean {
    const activeStatus = CircuitString.fromString("ACTIVE");
    return status.equals(activeStatus).toBoolean();
  }

  // Registration status validation
  static isRegistrationStatusIssued(status: CircuitString): boolean {
    const issuedStatus = CircuitString.fromString("ISSUED");
    return status.equals(issuedStatus).toBoolean();
  }

  // Conformity flag validation
  static isConformityCompliant(flag: CircuitString): boolean {
    const conformingFlag = CircuitString.fromString("CONFORMING");
    const unknownFlag = CircuitString.fromString("UNKNOWN");
    const emptyFlag = CircuitString.fromString("");
    
    return conformingFlag.equals(flag).toBoolean() ||
           unknownFlag.equals(flag).toBoolean() ||
           emptyFlag.equals(flag).toBoolean();
  }

  // Date validation
  static isDateValid(dateStr: CircuitString): boolean {
    const emptyDate = CircuitString.fromString("");
    return !dateStr.equals(emptyDate).toBoolean();
  }

  // LEI validation
  static hasValidLEI(lei: CircuitString): boolean {
    const emptyLEI = CircuitString.fromString("");
    return !lei.equals(emptyLEI).toBoolean();
  }

  // Overall compliance check (combining all business rules)
  static checkOverallCompliance(
    entityStatus: CircuitString,
    registrationStatus: CircuitString,
    conformityFlag: CircuitString,
    lastUpdate: CircuitString,
    nextRenewal: CircuitString,
    lei: CircuitString
  ): boolean {
    return this.isEntityStatusActive(entityStatus) &&
           this.isRegistrationStatusIssued(registrationStatus) &&
           this.isConformityCompliant(conformityFlag) &&
           this.isDateValid(lastUpdate) &&
           this.isDateValid(nextRenewal) &&
           this.hasValidLEI(lei);
  }
}
