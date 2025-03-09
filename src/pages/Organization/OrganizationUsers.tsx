import { useQuery } from "@tanstack/react-query";
import { Link } from "raviger";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { isValidPhoneNumber } from "react-phone-number-input";

import CareIcon from "@/CAREUI/icons/CareIcon";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Avatar } from "@/components/Common/Avatar";
import { CardGridSkeleton } from "@/components/Common/SkeletonLoading";
import { UserStatusIndicator } from "@/components/Users/UserListAndCard";

import useFilters from "@/hooks/useFilters";

import routes from "@/Utils/request/api";
import query from "@/Utils/request/query";
import organizationApi from "@/types/organization/organizationApi";

import AddUserSheet from "./components/AddUserSheet";
import EditUserRoleSheet from "./components/EditUserRoleSheet";
import EntityBadge from "./components/EntityBadge";
import LinkUserSheet from "./components/LinkUserSheet";
import OrganizationLayout from "./components/OrganizationLayout";

interface Props {
  id: string;
  navOrganizationId?: string;
}

// Create separate component for role selector UI
const RoleSelector = ({ onChange }: { onChange: (roleId: string) => void }) => {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Fetch all roles
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: query(routes.role.list),
  });

  const handleRoleChange = (value: string) => {
    setSelectedRole(value);
    onChange(value);
  };

  return (
    <Select value={selectedRole} onValueChange={handleRoleChange}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue placeholder={t("search_by_role")} />
      </SelectTrigger>
      <SelectContent>
        {roles?.results?.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            <div className="flex flex-col text-left">
              <span>{role.name}</span>
              {role.description && (
                <span className="text-xs text-gray-500">
                  {role.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default function OrganizationUsers({ id, navOrganizationId }: Props) {
  const { qParams, updateQuery, Pagination, resultsPerPage } = useFilters({
    limit: 15,
    cacheBlacklist: ["name", "phone_number", "role"],
  });
  const { t } = useTranslation();

  // Keep track of which search option is selected but don't change the UI based on it
  const [currentSearchOption, setCurrentSearchOption] =
    useState<string>("username");

  // Define search options for username and phone_number only
  const searchOptions = [
    {
      key: "username",
      type: "text" as const,
      placeholder: "Search by username",
      value: qParams.name || "",
    },
    {
      key: "phone_number",
      type: "phone" as const,
      placeholder: "Search by phone number",
      value: qParams.phone_number || "",
    },
    {
      key: "role",
      type: "text" as const,
      placeholder: t("search_by_role"),
      value: "", // Don't use qParams.role here, the role selector will handle this separately
    },
  ];

  // Track the current search option
  useEffect(() => {
    if (qParams.name) {
      setCurrentSearchOption("username");
    } else if (qParams.phone_number) {
      setCurrentSearchOption("phone_number");
    } else if (qParams.role) {
      setCurrentSearchOption("role");
    }
  }, [qParams]);

  const handleSearch = useCallback(
    (key: string, value: string) => {
      if (key === "username") {
        updateQuery({
          name: value,
          phone_number: undefined,
          role: undefined,
        });
      } else if (key === "phone_number") {
        updateQuery({
          name: undefined,
          phone_number: isValidPhoneNumber(value) ? value : undefined,
          role: undefined,
        });
      }
      // Role search is handled separately by handleRoleChange
    },
    [updateQuery],
  );

  const handleFieldChange = (option: any) => {
    setCurrentSearchOption(option.key);

    if (option.key === "role") {
      // Clear other search parameters when switching to role
      updateQuery({
        name: undefined,
        phone_number: undefined,
      });
    } else {
      // Clear role parameter when switching to other search options
      updateQuery({
        role: undefined,
      });
    }
  };

  const handleRoleChange = (roleId: string) => {
    updateQuery({
      role: roleId,
      name: undefined,
      phone_number: undefined,
    });
  };

  const openAddUserSheet = qParams.sheet === "add";
  const openLinkUserSheet = qParams.sheet === "link";

  const { data: users, isFetching: isFetchingUsers } = useQuery({
    queryKey: [
      "organizationUsers",
      id,
      qParams.name,
      qParams.phone_number,
      qParams.role,
      qParams.page,
    ],
    queryFn: query.debounced(organizationApi.listUsers, {
      pathParams: { id },
      queryParams: {
        username: qParams.name,
        phone_number: qParams.phone_number,
        page: qParams.page,
        limit: resultsPerPage,
        offset: ((qParams.page ?? 1) - 1) * resultsPerPage,
      },
    }),
    enabled: !!id,
  });

  // Filter users by role client-side
  const filteredUsers = useMemo(() => {
    if (!users?.results || !qParams.role) {
      return users;
    }

    const roleFilter = qParams.role;
    const filteredResults = users.results.filter(
      (userRole) => userRole.role.id === roleFilter,
    );

    return {
      ...users,
      count: filteredResults.length,
      results: filteredResults,
    };
  }, [users, qParams.role]);

  // Custom SearchByMultipleFields implementation that integrates the role selector
  const SearchWithRoleSelector = () => {
    const { t } = useTranslation();

    return (
      <div className="border rounded-lg border-gray-200 bg-white shadow">
        <div className="flex items-center rounded-t-lg">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="focus:ring-0 px-2 ml-1"
                size="sm"
              >
                <CareIcon icon="l-search" className="mr-2 text-base" />
                <span className="mr-2">{t(currentSearchOption)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="absolute p-0">
              <Command>
                <CommandList>
                  <CommandGroup>
                    <div className="p-4">
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-600">
                          {t("search_by")}
                        </p>
                        <div className="flex mt-2">
                          <Button
                            variant="outline"
                            size="xs"
                            className="bg-primary-100 text-primary-700 hover:bg-primary-200 border-primary-400"
                          >
                            <CareIcon icon="l-check" className="mr-1" />
                            {t(currentSearchOption)}
                          </Button>
                        </div>
                      </div>
                      <hr className="border-gray-200 mb-3" />
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          {t("choose_other_search_type")}
                        </p>
                        <div className="space-y-2">
                          {searchOptions
                            .filter(
                              (option) => option.key !== currentSearchOption,
                            )
                            .map((option) => (
                              <CommandItem
                                key={option.key}
                                onSelect={() => {
                                  setCurrentSearchOption(option.key);
                                  handleFieldChange(option);
                                }}
                                className="flex items-center p-2 rounded-md cursor-pointer hover:bg-secondary-100"
                              >
                                <span className="flex-1 text-sm">
                                  {t(option.key)}
                                </span>
                              </CommandItem>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex-1 p-2">
            {currentSearchOption === "role" ? (
              <RoleSelector onChange={handleRoleChange} />
            ) : currentSearchOption === "phone_number" ? (
              <PhoneInput
                placeholder={t("search_by_phone_number")}
                value={qParams.phone_number || ""}
                onChange={(value) => handleSearch("phone_number", value || "")}
                className="w-full"
              />
            ) : (
              <Input
                placeholder={t("search_by_username")}
                value={qParams.name || ""}
                onChange={(e) => handleSearch("username", e.target.value)}
                className="w-full border-none shadow-none focus-visible:ring-0"
              />
            )}
          </div>
        </div>

        {/* Keep the option buttons */}
        <div className="flex flex-wrap gap-2 p-2 border-t rounded-b-lg bg-gray-50 border-t-gray-100">
          {searchOptions.map((option) => (
            <Button
              key={option.key}
              onClick={() => {
                setCurrentSearchOption(option.key);
                handleFieldChange(option);
              }}
              variant="outline"
              size="xs"
              className={
                currentSearchOption === option.key
                  ? "bg-primary-100 text-primary-700 hover:bg-primary-200 border-primary-400"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            >
              {t(option.key)}
            </Button>
          ))}
        </div>

        {/* Clear search button */}
        {(qParams.name || qParams.phone_number || qParams.role) && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-center text-gray-500"
            onClick={() => {
              updateQuery({
                name: undefined,
                phone_number: undefined,
                role: undefined,
              });
            }}
          >
            <CareIcon icon="l-times" className="mr-2 h-4 w-4" />
            {t("clear_search")}
          </Button>
        )}
      </div>
    );
  };

  if (!id) {
    return null;
  }

  return (
    <OrganizationLayout id={id} navOrganizationId={navOrganizationId}>
      <div className="space-y-6">
        <div className="justify-between items-center flex flex-wrap">
          <div className="mt-1 flex flex-col justify-start space-y-2 md:flex-row md:justify-between md:space-y-0">
            <EntityBadge
              title={t("users")}
              count={filteredUsers?.count}
              isFetching={isFetchingUsers}
              translationParams={{ entity: "User" }}
            />
          </div>
          <div className="gap-2 flex flex-wrap mt-2">
            <AddUserSheet
              open={openAddUserSheet}
              setOpen={(open) => {
                updateQuery({ sheet: open ? "add" : "" });
              }}
              onUserCreated={(user) => {
                updateQuery({ sheet: "link", username: user.username });
              }}
              organizationId={id}
            />
            <LinkUserSheet
              organizationId={id}
              open={openLinkUserSheet}
              setOpen={(open) => {
                updateQuery({ sheet: open ? "link" : "", username: "" });
              }}
              preSelectedUsername={qParams.username}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-full">
            {/* Replace SearchByMultipleFields with our custom component */}
            <SearchWithRoleSelector />
          </div>
        </div>
        {isFetchingUsers ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CardGridSkeleton count={6} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers?.results?.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-6 text-center text-gray-500">
                  {t("no_users_found")}
                </CardContent>
              </Card>
            ) : (
              filteredUsers?.results?.map((userRole) => (
                <Card key={userRole.id} className="h-full">
                  <CardContent className="p-4 sm:p-6 flex flex-col h-full justify-between">
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={`${userRole.user.first_name} ${userRole.user.last_name}`}
                        imageUrl={userRole.user.profile_picture_url}
                        className="h-12 w-12 sm:h-14 sm:w-14 text-xl sm:text-2xl flex-shrink-0"
                      />

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between">
                            <h1 className="text-base font-bold break-words pr-2">
                              {userRole.user.first_name}{" "}
                              {userRole.user.last_name}
                            </h1>
                            <span className="text-sm text-gray-500">
                              <UserStatusIndicator user={userRole.user} />
                            </span>
                          </div>
                          <span className="text-sm text-gray-500 mr-2 break-words">
                            {userRole.user.username}
                          </span>
                        </div>
                        <div className="mt-4 -ml-12 sm:ml-0 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-gray-500">{t("role")}</div>
                            <div className="font-medium truncate">
                              {userRole.role.name ?? "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">
                              {t("phone_number")}
                            </div>
                            <div className="font-medium truncate">
                              {userRole.user.phone_number
                                ? formatPhoneNumberIntl(
                                    userRole.user.phone_number,
                                  )
                                : "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 -mx-2 -mb-2 sm:-mx-4 sm:-mb-4 rounded-md py-4 px-4 bg-gray-50 flex justify-end gap-2">
                      <EditUserRoleSheet
                        organizationId={id}
                        userRole={userRole}
                        trigger={
                          <Button variant="outline" size="sm">
                            <span>{t("edit_role")}</span>
                          </Button>
                        }
                      />
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/users/${userRole.user.username}`}>
                          <CareIcon
                            icon="l-arrow-up-right"
                            className="text-lg mr-1"
                          />
                          <span>{t("see_details")}</span>
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
        <Pagination totalCount={filteredUsers?.count || 0} />
      </div>
    </OrganizationLayout>
  );
}
