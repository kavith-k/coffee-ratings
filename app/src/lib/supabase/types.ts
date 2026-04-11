export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			cafes: {
				Row: {
					area: string | null;
					created_at: string;
					created_by: string | null;
					id: string;
					lat: number | null;
					lng: number | null;
					name: string;
				};
				Insert: {
					area?: string | null;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					lat?: number | null;
					lng?: number | null;
					name: string;
				};
				Update: {
					area?: string | null;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					lat?: number | null;
					lng?: number | null;
					name?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'cafes_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			group_members: {
				Row: {
					group_id: string;
					joined_at: string;
					role: string;
					user_id: string;
				};
				Insert: {
					group_id: string;
					joined_at?: string;
					role?: string;
					user_id: string;
				};
				Update: {
					group_id?: string;
					joined_at?: string;
					role?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'group_members_group_id_fkey';
						columns: ['group_id'];
						isOneToOne: false;
						referencedRelation: 'groups';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'group_members_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			groups: {
				Row: {
					created_at: string;
					created_by: string;
					id: string;
					invite_code: string;
					name: string;
				};
				Insert: {
					created_at?: string;
					created_by: string;
					id?: string;
					invite_code?: string;
					name: string;
				};
				Update: {
					created_at?: string;
					created_by?: string;
					id?: string;
					invite_code?: string;
					name?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'groups_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			profiles: {
				Row: {
					created_at: string;
					display_name: string;
					id: string;
				};
				Insert: {
					created_at?: string;
					display_name: string;
					id: string;
				};
				Update: {
					created_at?: string;
					display_name?: string;
					id?: string;
				};
				Relationships: [];
			};
			ratings: {
				Row: {
					cafe_id: string;
					created_at: string;
					id: string;
					rating: number;
					user_id: string;
					visited_at: string;
				};
				Insert: {
					cafe_id: string;
					created_at?: string;
					id?: string;
					rating: number;
					user_id: string;
					visited_at?: string;
				};
				Update: {
					cafe_id?: string;
					created_at?: string;
					id?: string;
					rating?: number;
					user_id?: string;
					visited_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'ratings_cafe_id_fkey';
						columns: ['cafe_id'];
						isOneToOne: false;
						referencedRelation: 'cafes';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'ratings_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			create_group: { Args: { p_name: string }; Returns: string };
			get_activity_feed: {
				Args: { p_cursor?: string; p_limit?: number };
				Returns: {
					area: string;
					cafe_id: string;
					cafe_name: string;
					created_at: string;
					display_name: string;
					rating: number;
					rating_id: string;
					user_id: string;
					visited_at: string;
				}[];
			};
			get_cafe_personalised_average: {
				Args: { p_cafe_id: string };
				Returns: {
					avg_rating: number;
					num_raters: number;
					num_ratings: number;
				}[];
			};
			get_group_preview_by_invite_code: {
				Args: { code: string };
				Returns: {
					member_count: number;
					name: string;
				}[];
			};
			get_personalised_cafe_list: {
				Args: {
					p_area?: string;
					p_limit?: number;
					p_offset?: number;
					p_sort_by?: string;
				};
				Returns: {
					area: string;
					avg_rating: number;
					cafe_id: string;
					cafe_name: string;
					lat: number;
					lng: number;
					num_raters: number;
					num_ratings: number;
				}[];
			};
			join_group_by_invite_code: { Args: { code: string }; Returns: string };
			search_cafes: {
				Args: { query: string; result_limit?: number };
				Returns: {
					area: string;
					id: string;
					lat: number;
					lng: number;
					name: string;
					similarity: number;
				}[];
			};
			show_limit: { Args: never; Returns: number };
			show_trgm: { Args: { '': string }; Returns: string[] };
			user_group_ids: { Args: never; Returns: string[] };
			visible_user_ids: { Args: never; Returns: string[] };
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {}
	}
} as const;
